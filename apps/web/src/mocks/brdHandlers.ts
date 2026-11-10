import {
  BacklogItemPatch,
  BacklogList,
  BrdContent,
  BrdDecision,
  BrdList,
  checkBrd,
  isPushable,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { z } from "zod";
import { type BrdRecord, externalKey, generateBacklog } from "./ba";
import { generationStartedAt, getSession } from "./db";
import { apiError, guardTenant } from "./guard";

const T = "/api/t/:tenantId";
const isTest = import.meta.env.MODE === "test";
const latency = () => (isTest ? Promise.resolve() : delay(200));
const BACKLOG_MS = isTest ? 0 : 5500;
const me = () => getSession().user.name;
const now = () => new Date().toISOString();

const bump = (v: string, major: boolean) => {
  const [a = 0, b = 0] = v.split(".").map(Number);
  return major ? `${a + 1}.0` : `${a}.${b + 1}`;
};

function refreshBacklog(tenantId: string, rec: BrdRecord) {
  const b = rec.backlog;
  if (b.status !== "generating") return;
  const started = generationStartedAt.get(`${tenantId}:${b.id}`) ?? Date.now();
  const progress = BACKLOG_MS === 0 ? 100 : Math.min(100, ((Date.now() - started) / BACKLOG_MS) * 100);
  if (progress < 100) {
    rec.backlog = { ...b, progress: Math.round(progress) };
    return;
  }
  // Keep tool keys for items that still exist with the same title, so a regenerate doesn't duplicate.
  const previous = new Map(b.items.map((i) => [`${i.type}:${i.title}`, i.external]));
  const items = generateBacklog(rec.brd.content, rec.hints, rec.brd.id).map((i) => ({
    ...i,
    external: previous.get(`${i.type}:${i.title}`) ?? null,
  }));
  rec.backlog = {
    ...b,
    status: "ready",
    progress: 100,
    items,
    brdVersion: rec.brd.version,
    generatedAt: now(),
  };
}

const brdList = (records: BrdRecord[]) => BrdList.parse({ items: records.map((r) => r.brd) });
const backlogList = (tenantId: string, records: BrdRecord[]) => {
  for (const r of records) refreshBacklog(tenantId, r);
  return BacklogList.parse({ items: records.map((r) => r.backlog) });
};

const find = (records: BrdRecord[], id: unknown) => records.find((r) => r.brd.id === id);
const findBacklog = (records: BrdRecord[], id: unknown) => records.find((r) => r.backlog.id === id);

export const brdHandlers = [
  http.get(`${T}/brds`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(brdList(g.store.brds));
  }),

  http.put(`${T}/brds/:brdId/content`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store.brds, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (rec.brd.status === "in-review" || rec.brd.status === "approved") {
      return apiError(409, "conflict", "This version is locked. Raise a change request to edit it.");
    }
    const body = BrdContent.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "The BRD content is malformed");
    rec.brd = { ...rec.brd, content: body.data, updatedAt: now() };
    return HttpResponse.json(brdList(g.store.brds));
  }),

  http.post(`${T}/brds/:brdId/submit`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store.brds, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (rec.brd.status !== "draft" && rec.brd.status !== "changes-requested") {
      return apiError(409, "conflict", "Only a draft can be submitted");
    }
    const errors = checkBrd(rec.brd.content).filter((c) => c.severity === "error");
    if (errors.length > 0) {
      return apiError(
        400,
        "invalid",
        `Fix ${errors.length} blocking issue${errors.length > 1 ? "s" : ""} first: ${errors[0]?.message}`,
      );
    }
    const version = bump(rec.brd.version, false);
    rec.brd = {
      ...rec.brd,
      status: "in-review",
      version,
      submittedBy: me(),
      updatedAt: now(),
      approvals: rec.brd.approvals.map((a) => ({ ...a, status: "pending", at: null, comment: null })),
      history: [...rec.brd.history, { version, at: now(), by: me(), what: "Submitted for approval" }],
    };
    return HttpResponse.json(brdList(g.store.brds));
  }),

  http.post(`${T}/brds/:brdId/decision`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "brd.approve");
    if ("error" in g) return g.error;
    const rec = find(g.store.brds, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    const body = BrdDecision.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Decision is malformed");
    if (rec.brd.status !== "in-review")
      return apiError(409, "conflict", "This BRD is not waiting for approval");
    const slot = rec.brd.approvals.find((a) => a.id === body.data.approvalId);
    if (!slot) return apiError(404, "not_found", "No such approval");
    if (!slot.isMe) return apiError(403, "forbidden", `This approval belongs to ${slot.name}`);
    if (rec.brd.submittedBy === me()) {
      return apiError(403, "forbidden", "You submitted this BRD, so someone else must approve it");
    }
    if (body.data.decision === "request-changes" && !body.data.comment?.trim()) {
      return apiError(400, "invalid", "Say what needs to change");
    }
    const approvals = rec.brd.approvals.map((a) =>
      a.id === slot.id
        ? {
            ...a,
            status: body.data.decision === "approve" ? ("approved" as const) : ("changes-requested" as const),
            at: now(),
            comment: body.data.comment?.trim() || null,
          }
        : a,
    );
    const allApproved = approvals.every((a) => a.status === "approved");
    const changes = body.data.decision === "request-changes";
    const version = allApproved ? bump(rec.brd.version, true) : rec.brd.version;
    rec.brd = {
      ...rec.brd,
      approvals,
      version,
      status: allApproved ? "approved" : changes ? "changes-requested" : "in-review",
      updatedAt: now(),
      history: [
        ...rec.brd.history,
        {
          version,
          at: now(),
          by: me(),
          what: changes
            ? `Requested changes as ${slot.capacity}`
            : allApproved
              ? `Approved as ${slot.capacity}. All approvals in; version ${version} is the baseline.`
              : `Approved as ${slot.capacity}`,
        },
      ],
    };
    return HttpResponse.json(brdList(g.store.brds));
  }),

  http.post(`${T}/brds/:brdId/change-request`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store.brds, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    const body = z.object({ reason: z.string().trim().min(5).max(500) }).safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Give a reason for the change");
    if (rec.brd.status !== "approved")
      return apiError(409, "conflict", "Only an approved BRD needs a change request");
    const version = bump(rec.brd.version, false);
    rec.brd = {
      ...rec.brd,
      status: "draft",
      version,
      submittedBy: null,
      updatedAt: now(),
      approvals: rec.brd.approvals.map((a) => ({ ...a, status: "pending", at: null, comment: null })),
      history: [
        ...rec.brd.history,
        { version, at: now(), by: me(), what: `Change request: ${body.data.reason}` },
      ],
    };
    if (rec.backlog.status === "ready") rec.backlog = { ...rec.backlog, status: "stale" };
    return HttpResponse.json(brdList(g.store.brds));
  }),

  /* Backlog generated from the approved BRD */
  http.get(`${T}/backlogs`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(backlogList(g.tenantId, g.store.brds));
  }),

  http.post(`${T}/backlogs/:backlogId/generate`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const rec = findBacklog(g.store.brds, params.backlogId);
    if (!rec) return apiError(404, "not_found", "No such backlog");
    if (rec.brd.status !== "approved") return apiError(409, "conflict", "The BRD must be approved first");
    if (rec.backlog.status === "generating") return apiError(409, "conflict", "Already generating");
    generationStartedAt.set(`${g.tenantId}:${rec.backlog.id}`, Date.now());
    rec.backlog = { ...rec.backlog, status: "generating", progress: 0 };
    return HttpResponse.json(backlogList(g.tenantId, g.store.brds));
  }),

  http.patch(`${T}/backlogs/:backlogId/items/:itemId`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const rec = findBacklog(g.store.brds, params.backlogId);
    if (!rec) return apiError(404, "not_found", "No such backlog");
    const body = BacklogItemPatch.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Invalid change");
    if (!rec.backlog.items.some((i) => i.id === params.itemId))
      return apiError(404, "not_found", "No such item");
    rec.backlog = {
      ...rec.backlog,
      items: rec.backlog.items.map((i) => (i.id === params.itemId ? { ...i, ...body.data } : i)),
    };
    return HttpResponse.json(backlogList(g.tenantId, g.store.brds));
  }),

  http.post(`${T}/backlogs/:backlogId/push`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const rec = findBacklog(g.store.brds, params.backlogId);
    if (!rec) return apiError(404, "not_found", "No such backlog");
    if (rec.backlog.status !== "ready")
      return apiError(409, "conflict", "Generate an up-to-date backlog first");
    if (!rec.backlog.targetConnected)
      return apiError(409, "conflict", "Connect the work tracker in Settings → Integrations");
    let seq = rec.backlog.items.filter((i) => i.external).length;
    rec.backlog = {
      ...rec.backlog,
      pushedAt: now(),
      pushedBy: me(),
      items: rec.backlog.items.map((i) =>
        i.external || !isPushable(rec.backlog.target, i)
          ? i
          : { ...i, external: externalKey(rec.backlog.target, rec.backlog.project, ++seq) },
      ),
    };
    return HttpResponse.json(backlogList(g.tenantId, g.store.brds));
  }),
];
