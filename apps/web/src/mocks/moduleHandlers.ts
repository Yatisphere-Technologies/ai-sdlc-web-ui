import {
  type Action,
  ARCH_STEPS,
  ArchBrief,
  ArchChoice,
  ArchitectureList,
  type AskAnswer,
  AskRequest,
  BuildBoard,
  blockingFindings,
  ChoiceImpact,
  DesignList,
  GATE_AFTER_STAGE,
  IncidentList,
  InsightsPeriod,
  type Membership,
  ReleaseList,
  ReviewList,
  type ReviewPack,
  SignoffRequest,
  SpecList,
  STAGE_LABEL,
  STAGES,
  type Trace,
  UpdateControl,
  UpdateFinding,
  VerifyList,
  type WorkItem,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { z } from "zod";
import { type ArchitectureRecord, generateArchitecture, previewChoice } from "./architect";
import { generationStartedAt, getSession } from "./db";
import { apiError, guardTenant } from "./guard";
import { sourceBrd } from "./projects";
import { reviewArtifacts, reviewFindings } from "./seed/review";
import type { TenantSeed } from "./seed/types";

const T = "/api/t/:tenantId";
const isTest = import.meta.env.MODE === "test";
const latency = () => (isTest ? Promise.resolve() : delay(220));
const GENERATION_MS = isTest ? 0 : 7000;
const ARCH_MS = isTest ? 0 : 6500;

const can = (m: Membership, ...actions: Action[]) => actions.some((a) => m.allowedActions.includes(a));
const me = () => getSession().user.name;
const forbidden = (msg: string) => apiError(403, "forbidden", msg);

/** Advances a generating pack based on elapsed time, the way a background job would. */
function refreshPack(store: TenantSeed, pack: ReviewPack): ReviewPack {
  if (pack.status !== "generating") return pack;
  const subject = store.modules.reviewSubjects[pack.id];
  const started = generationStartedAt.get(`${pack.id}`) ?? Date.now();
  const progress = GENERATION_MS === 0 ? 100 : Math.min(100, ((Date.now() - started) / GENERATION_MS) * 100);
  const template = subject ? reviewArtifacts(subject) : [];
  const n = template.length || 1;
  const artifacts = template.map((a, i) => ({
    ...a,
    status:
      progress >= ((i + 1) / n) * 100
        ? ("draft" as const)
        : progress >= (i / n) * 100
          ? ("generating" as const)
          : ("queued" as const),
  }));
  const done = progress >= 100;
  const next: ReviewPack = {
    ...pack,
    progress: Math.round(progress),
    artifacts,
    status: done ? "in-review" : "generating",
    findings: done ? reviewFindings(pack.id, false) : [],
  };
  store.modules.reviews = store.modules.reviews.map((p) => (p.id === pack.id ? next : p));
  return next;
}

/** Advances an architecture that the agent is drawing, then produces the pack when time is up. */
function refreshArchitecture(
  tenantId: string,
  store: TenantSeed,
  rec: ArchitectureRecord,
): ArchitectureRecord {
  const a = rec.architecture;
  if (a.status !== "generating") return rec;
  const started = generationStartedAt.get(`${tenantId}:${a.id}`) ?? Date.now();
  const progress = ARCH_MS === 0 ? 100 : Math.min(100, ((Date.now() - started) / ARCH_MS) * 100);
  const steps = ARCH_STEPS.map((label, i) => ({
    label,
    done: progress >= ((i + 1) / ARCH_STEPS.length) * 100,
  }));
  if (progress < 100) {
    rec.architecture = { ...a, progress: Math.round(progress), steps };
    return rec;
  }
  const revision = a.revision + 1;
  const out = generateArchitecture(a.brief, rec.subject, revision, sourceBrd(store, a.id));
  rec.architecture = {
    ...a,
    ...out,
    status: "ready",
    progress: 100,
    steps,
    revision,
    generatedAt: new Date().toISOString(),
  };
  return rec;
}

const architectureList = (tenantId: string, store: TenantSeed) =>
  ArchitectureList.parse({
    items: store.architectures.map((r) => refreshArchitecture(tenantId, store, r).architecture),
  });

function traceFor(store: TenantSeed, item: WorkItem): Trace {
  const rich = store.modules.traces.find((t) => t.workItemKey === item.key);
  if (rich) return rich;
  const at = STAGES.indexOf(item.stage);
  return {
    workItemKey: item.key,
    title: item.title,
    totalDays: item.ageDays,
    segments: [
      { label: "Agent work", days: Math.round(item.ageDays * 0.4 * 10) / 10, kind: "agent" },
      { label: "Waiting at gates", days: Math.round(item.ageDays * 0.45 * 10) / 10, kind: "wait" },
      { label: "People working", days: Math.round(item.ageDays * 0.15 * 10) / 10, kind: "human" },
    ],
    steps: STAGES.slice(0, at + 1).map((stage, i) => ({
      stage,
      gate: GATE_AFTER_STAGE[stage] ?? null,
      artifact: i === 0 ? item.key : `${item.key}-${stage}`,
      title:
        i === at ? `In ${STAGE_LABEL[stage]} · ${item.waitingOn.label}` : `${STAGE_LABEL[stage]} complete`,
      actor: i === at ? item.waitingOn.label : `${stage}-agent`,
      actorKind: i === at && item.waitingOn.kind === "human" ? "human" : "agent",
      when: `Day ${i + 1}`,
      tool:
        [
          "Jira",
          "Confluence",
          "Confluence",
          "Confluence",
          "GitHub",
          "GitHub",
          "Argo CD",
          "Datadog",
          "GitHub",
        ][i] ?? "Platform",
      evidence: [{ k: "Status", v: i === at ? "In progress" : "Done" }],
      evidenceHash: `sha256:${(item.key.length * 977 + i * 131).toString(16)}…`,
    })),
  };
}

export function answer(store: TenantSeed, question: string): AskAnswer {
  const q = question.toLowerCase();
  const asOf = `As of ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · read live from your tools`;
  const items = store.workItems.items;

  if (/(waiting|on me|my decisions|approve)/.test(q)) {
    const open = store.controlRoom.decisions.filter((d) => d.status === "open");
    const packs = store.modules.reviews.filter((p) => p.status === "in-review");
    return {
      question,
      headline: `${open.length + packs.length} decisions are waiting on people.`,
      stage: null,
      rows: [
        ...open.map((d) => ({
          tone: "gate" as const,
          text: `${d.gate.toUpperCase()} · ${d.title}`,
          sub: d.meta,
          source: d.gate === "g3" ? "GitHub" : "Confluence",
        })),
        ...packs.map((p) => ({
          tone: "gate" as const,
          text: `G2 review pack · ${p.title}`,
          sub: `${blockingFindings(p).length} blocking findings`,
          source: "Platform",
        })),
      ],
      actions: ["Open my decisions", "Snooze until Monday"],
      asOf,
    };
  }
  if (/(ship|released|rollout|deploy)/.test(q)) {
    return {
      question,
      headline: `${store.modules.releases.length} release in progress. No rollbacks this week.`,
      stage: "release",
      rows: store.modules.releases.map((r) => ({
        tone: r.status === "rolled-back" ? ("risk" as const) : ("ok" as const),
        text: `${r.name} · ${r.service}`,
        sub: `${r.steps[r.currentStep]?.percent ?? 0}% · ${r.status}`,
        source: "Argo CD",
      })),
      actions: ["Draft release notes", "Post to the team channel"],
      asOf,
    };
  }
  if (/(review|security|architecture|threat)/.test(q)) {
    return {
      question,
      headline: "Architecture and security review status across work in flight.",
      stage: "review",
      rows: store.modules.reviews.map((p) => ({
        tone:
          p.status === "signed-off"
            ? ("ok" as const)
            : blockingFindings(p).length
              ? ("risk" as const)
              : ("gate" as const),
        text: `${p.title} · ${p.status.replace("-", " ")}`,
        sub: `${p.artifacts.length} artifacts · ${blockingFindings(p).length} blocking findings`,
        source: "Platform",
      })),
      actions: ["Open review packs"],
      asOf,
    };
  }
  if (/(lead time|slow|cycle|dora|why)/.test(q)) {
    const i = store.modules.insights["30d"];
    return {
      question,
      headline: `Lead time is ${i.dora[0]?.value}. Most of it is waiting at gates, not agent work.`,
      stage: null,
      rows: [
        {
          tone: "gate",
          text: "Waiting at G2 and G3 is over half of lead time",
          sub: "Review sign-off and two-key code review",
          source: "Platform",
        },
        {
          tone: "ok",
          text: "Agent build time is steady",
          sub: "No regression in agent work",
          source: "Platform",
        },
        {
          tone: "ion",
          text: "Suggestion: single-key review for tier 1 changes",
          sub: "Needs a policy change",
          source: "Policy",
        },
      ],
      actions: ["Propose the policy change", "Show by team"],
      asOf,
    };
  }

  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const hit = items.find((w) => words.some((word) => w.title.toLowerCase().includes(word)));
  if (hit) {
    const blocked = hit.waitingOn.kind === "human";
    return {
      question,
      headline: `${hit.title} is in ${STAGE_LABEL[hit.stage]}. ${blocked ? `It's waiting on ${hit.waitingOn.label}.` : "Agents are working on it."}`,
      stage: hit.stage,
      rows: [
        {
          tone: blocked ? "gate" : "ok",
          text: hit.waitingOn.label,
          sub: `${hit.key} · ${hit.team} · ${hit.ageDays} days old`,
          source: "Jira",
        },
        {
          tone: "ion",
          text: `Risk tier ${hit.risk}`,
          sub: hit.risk >= 2 ? "Needs a review pack and two-person sign-off" : "Light review",
          source: "Policy",
        },
        {
          tone: "ok",
          text: `AI spend so far $${hit.aiSpendUsd.toFixed(2)}`,
          sub: "Within team budget",
          source: "Platform",
        },
      ],
      actions: ["Open the trace", blocked ? "Nudge them" : "Watch it"],
      asOf,
    };
  }
  return {
    question,
    headline: "I couldn't match that to anything in this workspace.",
    stage: null,
    rows: [
      {
        tone: "ion",
        text: "Try a work item name, or ask what's waiting on you",
        sub: "For example: “Where is the refund export?”",
        source: "Platform",
      },
    ],
    actions: [],
    asOf,
  };
}

export const moduleHandlers = [
  /* Specs */
  http.get(`${T}/specs`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(SpecList.parse({ items: g.store.modules.specs }));
  }),
  http.patch(`${T}/specs/:specId/checklist/:itemId`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "gate.approve.g1");
    if ("error" in g) return g.error;
    const body = UpdateControl.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "enabled must be a boolean");
    g.store.modules.specs = g.store.modules.specs.map((s) =>
      s.id === params.specId
        ? {
            ...s,
            checklist: s.checklist.map((c) =>
              c.id === params.itemId ? { ...c, done: body.data.enabled } : c,
            ),
          }
        : s,
    );
    return HttpResponse.json(SpecList.parse({ items: g.store.modules.specs }));
  }),
  http.post(`${T}/specs/:specId/approve`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "gate.approve.g1");
    if ("error" in g) return g.error;
    const spec = g.store.modules.specs.find((s) => s.id === params.specId);
    if (!spec) return apiError(404, "not_found", "Spec not found");
    if (spec.checklist.some((c) => !c.done))
      return apiError(400, "invalid", "Complete the G1 checklist first");
    g.store.modules.specs = g.store.modules.specs.map((s) =>
      s.id === spec.id ? { ...s, status: "approved", approvedBy: me() } : s,
    );
    return HttpResponse.json(SpecList.parse({ items: g.store.modules.specs }));
  }),

  /* Design */
  http.get(`${T}/designs`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(DesignList.parse({ items: g.store.modules.designs }));
  }),
  http.post(`${T}/designs/:designId/decide`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "gate.approve.g2");
    if ("error" in g) return g.error;
    const body = z.object({ optionId: z.string() }).safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "optionId is required");
    g.store.modules.designs = g.store.modules.designs.map((d) =>
      d.id === params.designId
        ? { ...d, status: "decided", chosenOptionId: body.data.optionId, decidedBy: me() }
        : d,
    );
    return HttpResponse.json(DesignList.parse({ items: g.store.modules.designs }));
  }),

  /* Architecture studio */
  http.get(`${T}/architectures`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(architectureList(g.tenantId, g.store));
  }),
  http.put(`${T}/architectures/:archId/brief`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "architecture.edit");
    if ("error" in g) return g.error;
    const rec = g.store.architectures.find((r) => r.architecture.id === params.archId);
    if (!rec) return apiError(404, "not_found", "No such architecture");
    if (rec.architecture.status === "generating")
      return apiError(409, "conflict", "The agent is still drawing");
    const body = ArchBrief.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "The brief is incomplete");
    rec.architecture = {
      ...rec.architecture,
      brief: body.data,
      briefBy: me(),
      status: rec.architecture.diagrams.length > 0 ? "stale" : "brief",
    };
    return HttpResponse.json(architectureList(g.tenantId, g.store));
  }),
  http.post(`${T}/architectures/:archId/generate`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "architecture.edit");
    if ("error" in g) return g.error;
    const rec = g.store.architectures.find((r) => r.architecture.id === params.archId);
    if (!rec) return apiError(404, "not_found", "No such architecture");
    if (rec.architecture.status === "generating") return apiError(409, "conflict", "Already generating");
    generationStartedAt.set(`${g.tenantId}:${rec.architecture.id}`, Date.now());
    rec.architecture = {
      ...rec.architecture,
      status: "generating",
      progress: 0,
      briefBy: rec.architecture.briefBy ?? me(),
      steps: ARCH_STEPS.map((label) => ({ label, done: false })),
    };
    return HttpResponse.json(architectureList(g.tenantId, g.store));
  }),

  http.post(`${T}/architectures/:archId/preview`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const rec = g.store.architectures.find((r) => r.architecture.id === params.archId);
    if (!rec) return apiError(404, "not_found", "No such architecture");
    const body = ArchChoice.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Say which answer to change");
    const impact = previewChoice(
      rec.architecture.brief,
      rec.subject,
      body.data.field,
      body.data.value,
      sourceBrd(g.store, rec.architecture.id),
    );
    if (!impact) return apiError(400, "invalid", "That answer isn't one of the options");
    return HttpResponse.json(ChoiceImpact.parse(impact));
  }),

  /** Changes one brief answer and regenerates straight away, recording who changed what. */
  http.post(`${T}/architectures/:archId/choose`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "architecture.edit");
    if ("error" in g) return g.error;
    const rec = g.store.architectures.find((r) => r.architecture.id === params.archId);
    if (!rec) return apiError(404, "not_found", "No such architecture");
    if (rec.architecture.status === "generating")
      return apiError(409, "conflict", "The agent is still drawing");
    const body = ArchChoice.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Say which answer to change");
    const a = rec.architecture;
    const next = ArchBrief.safeParse({ ...a.brief, [body.data.field]: body.data.value });
    if (!(body.data.field in a.brief) || !next.success)
      return apiError(400, "invalid", "That answer isn't one of the options");
    const text = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));
    const revision = a.revision + 1;
    const out = generateArchitecture(next.data, rec.subject, revision, sourceBrd(g.store, a.id));
    rec.architecture = {
      ...a,
      ...out,
      brief: next.data,
      status: "ready",
      progress: 100,
      revision,
      generatedAt: new Date().toISOString(),
      history: [
        {
          at: new Date().toISOString(),
          by: me(),
          field: body.data.field,
          from: text(a.brief[body.data.field as keyof typeof a.brief]),
          to: text(body.data.value),
          revision,
        },
        ...a.history,
      ],
    };
    return HttpResponse.json(architectureList(g.tenantId, g.store));
  }),

  /* Review: architecture + security pack */
  http.get(`${T}/reviews`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const items = g.store.modules.reviews.map((p) => refreshPack(g.store, p));
    return HttpResponse.json(ReviewList.parse({ items }));
  }),
  http.post(`${T}/reviews/:packId/generate`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    if (!can(g.membership, "gate.approve.g2", "review.security.signoff", "work.create")) {
      return forbidden("Your role can't start a review");
    }
    const pack = g.store.modules.reviews.find((p) => p.id === params.packId);
    if (!pack) return apiError(404, "not_found", "Review pack not found");
    if (pack.status !== "not-started")
      return apiError(400, "invalid", "This pack has already been generated");
    generationStartedAt.set(pack.id, Date.now());
    g.store.modules.reviews = g.store.modules.reviews.map((p) =>
      p.id === pack.id ? { ...p, status: "generating", progress: 0 } : p,
    );
    const items = g.store.modules.reviews.map((p) => refreshPack(g.store, p));
    return HttpResponse.json(ReviewList.parse({ items }));
  }),
  http.patch(`${T}/reviews/:packId/findings/:findingId`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    if (!can(g.membership, "gate.approve.g2", "review.security.signoff"))
      return forbidden("Only reviewers can close findings");
    const body = UpdateFinding.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "status must be resolved or accepted");
    g.store.modules.reviews = g.store.modules.reviews.map((p) =>
      p.id === params.packId
        ? {
            ...p,
            findings: p.findings.map((f) =>
              f.id === params.findingId ? { ...f, status: body.data.status, resolvedBy: me() } : f,
            ),
          }
        : p,
    );
    return HttpResponse.json(ReviewList.parse({ items: g.store.modules.reviews }));
  }),
  http.post(`${T}/reviews/:packId/signoff`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const body = SignoffRequest.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "role must be architecture or security");
    const role = body.data.role;
    if (role === "architecture" && !can(g.membership, "gate.approve.g2"))
      return forbidden("Only an architect can sign this");
    if (role === "security" && !can(g.membership, "review.security.signoff"))
      return forbidden("Only security can sign this");
    const pack = g.store.modules.reviews.find((p) => p.id === params.packId);
    if (!pack) return apiError(404, "not_found", "Review pack not found");
    if (pack.status !== "in-review") return apiError(400, "invalid", "The pack isn't ready for sign-off");
    if (blockingFindings(pack).length > 0)
      return apiError(400, "invalid", "Resolve or accept every high and critical finding first");
    // Separation of duties: the same person can't provide both signatures.
    if (pack.signoffs.some((s) => s.role !== role && s.by === me())) {
      return forbidden("You already signed the other half. A different person must sign this one.");
    }
    const signoffs = pack.signoffs.map((s) => (s.role === role ? { ...s, by: me() } : s));
    const complete = signoffs.every((s) => s.by);
    const next: ReviewPack = {
      ...pack,
      signoffs,
      status: complete ? "signed-off" : "in-review",
      artifacts: complete ? pack.artifacts.map((a) => ({ ...a, status: "approved" })) : pack.artifacts,
    };
    g.store.modules.reviews = g.store.modules.reviews.map((p) => (p.id === pack.id ? next : p));
    return HttpResponse.json(ReviewList.parse({ items: g.store.modules.reviews }));
  }),

  /* Build */
  http.get(`${T}/build`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(BuildBoard.parse({ lanes: g.store.modules.build }));
  }),

  /* Verify (G3) */
  http.get(`${T}/verify`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(VerifyList.parse({ items: g.store.modules.verify }));
  }),
  http.post(`${T}/verify/:changeId/sign`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "gate.approve.g3");
    if ("error" in g) return g.error;
    g.store.modules.verify = g.store.modules.verify.map((v) =>
      v.id === params.changeId
        ? {
            ...v,
            status: "merged",
            keys: v.keys.map((k) => (k.role === "human" ? { ...k, name: me(), signed: true } : k)),
          }
        : v,
    );
    return HttpResponse.json(VerifyList.parse({ items: g.store.modules.verify }));
  }),

  /* Release (G4) */
  http.get(`${T}/releases`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(ReleaseList.parse({ items: g.store.modules.releases }));
  }),
  http.post(`${T}/releases/:releaseId/:op`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "gate.approve.g4");
    if ("error" in g) return g.error;
    if (params.op !== "promote" && params.op !== "rollback")
      return apiError(404, "not_found", "Unknown operation");
    g.store.modules.releases = g.store.modules.releases.map((r) => {
      if (r.id !== params.releaseId) return r;
      if (params.op === "rollback") return { ...r, currentStep: 0, status: "rolled-back" };
      const step = Math.min(r.currentStep + 1, r.steps.length - 1);
      return { ...r, currentStep: step, status: step === r.steps.length - 1 ? "complete" : "rolling" };
    });
    return HttpResponse.json(ReleaseList.parse({ items: g.store.modules.releases }));
  }),

  /* Operate → Learn */
  http.get(`${T}/incidents`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(IncidentList.parse({ items: g.store.modules.incidents }));
  }),
  http.post(`${T}/incidents/:incidentId/approve-fix`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "incident.approve");
    if ("error" in g) return g.error;
    g.store.modules.incidents = g.store.modules.incidents.map((i) =>
      i.id === params.incidentId
        ? {
            ...i,
            status: "resolved",
            timeline: [
              ...i.timeline,
              { time: "+5 min", text: `${me()} approved the fix · latency recovered`, kind: "ok" },
            ],
          }
        : i,
    );
    return HttpResponse.json(IncidentList.parse({ items: g.store.modules.incidents }));
  }),

  /* Trace */
  http.get(`${T}/trace/:workItemKey`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const item = g.store.workItems.items.find((w) => w.key === params.workItemKey);
    if (!item) return apiError(404, "not_found", "Work item not found");
    return HttpResponse.json(traceFor(g.store, item));
  }),

  /* Insights */
  http.get(`${T}/insights`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const period = InsightsPeriod.safeParse(new URL(request.url).searchParams.get("period") ?? "30d");
    if (!period.success) return apiError(400, "invalid", "period must be 30d, 90d or 6m");
    return HttpResponse.json(g.store.modules.insights[period.data]);
  }),

  /* Ask */
  http.post(`${T}/ask`, async ({ request, params }) => {
    await delay(isTest ? 0 : 900);
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const body = AskRequest.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Ask a question between 2 and 500 characters");
    return HttpResponse.json(answer(g.store, body.data.question));
  }),
];
