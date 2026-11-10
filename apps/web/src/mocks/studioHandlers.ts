import {
  AddSource,
  AgentMode,
  BrdContent,
  BrdDocUpdate,
  buildBody,
  Capture,
  type ChatMessage,
  CommentReply,
  type CommentThread,
  type DocNode,
  defaultLayout,
  deriveFromBody,
  NewBrd,
  NewComment,
  PostMessage,
  type Proposal,
  ProposalDecision,
  ResolveComment,
  SetStep,
  StudioState,
  syncBody,
  WorkspaceDocList,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import type { BrdRecord } from "./ba";
import { applyProposal } from "./ba/agent/apply";
import { captureItem, enterStep, respond } from "./ba/agent/engine";
import { readSource, workspaceDocs } from "./ba/agent/sources";
import { titleFrom } from "./ba/agent/text";
import { undoField } from "./ba/agent/undo";
import { getSession } from "./db";
import { apiError, guardTenant } from "./guard";
import type { TenantSeed } from "./seed/types";

const T = "/api/t/:tenantId";
const isTest = import.meta.env.MODE === "test";
const latency = (ms = 180) => (isTest ? Promise.resolve() : delay(ms));
const me = () => getSession().user.name;
const now = () => new Date().toISOString();

const state = (rec: BrdRecord) =>
  StudioState.parse({ brd: rec.brd, thread: rec.thread, sources: rec.sources, comments: rec.comments });
const editable = (rec: BrdRecord) => rec.brd.status === "draft" || rec.brd.status === "changes-requested";
const locked = () => apiError(409, "conflict", "This version is locked. Raise a change request to edit it.");

function say(rec: BrdRecord, role: ChatMessage["role"], text: string, extra: Partial<ChatMessage> = {}) {
  rec.thread.messages.push({
    id: `M${rec.seq++}`,
    role,
    text,
    at: now(),
    cites: [],
    proposals: [],
    suggestions: [],
    ...extra,
  });
}

/** Every proposal, from the chat and from comment threads. */
const allProposals = (rec: BrdRecord): Proposal[] => [
  ...rec.thread.messages.flatMap((m) => m.proposals),
  ...rec.comments.flatMap((c) => c.messages.flatMap((m) => m.proposals)),
];
const pending = (rec: BrdRecord) => allProposals(rec).filter((p) => p.status === "pending");

/** Commenting is open to editors and approvers; it stays open while a version is in review. */
function guardComment(request: Request, tenantId: unknown) {
  const g = guardTenant(request, tenantId);
  if ("error" in g) return g;
  const a = g.membership.allowedActions;
  if (!a.includes("brd.edit") && !a.includes("brd.approve"))
    return { error: apiError(403, "forbidden", "Your role in this workspace can't comment") } as const;
  return g;
}

/** Keeps the rich-text document in step after the agent (or a form) changes the content. */
function syncDocument(rec: BrdRecord) {
  if (rec.brd.body === undefined) return;
  rec.brd.body = syncBody(rec.brd.body as DocNode, rec.brd.content);
}

const agentInput = (rec: BrdRecord) => ({
  content: rec.brd.content,
  sources: rec.sources,
  focus: rec.thread.focus,
  pending: pending(rec),
  nextSeq: rec.seq,
  step: rec.thread.step,
  skipped: rec.thread.skipped,
  live: rec.thread.autoApply && editable(rec),
});

type AgentOut = ReturnType<typeof respond>;

/**
 * With live editing on, the agent's edits go straight into the document, each one recorded with the
 * field before and after so the author can undo it. Edits that no longer fit stay as suggestions.
 */
function applyLive(rec: BrdRecord, proposals: Proposal[]) {
  if (!rec.thread.autoApply || !editable(rec)) return;
  for (const p of proposals) {
    if (p.status !== "pending") continue;
    const key = p.target as keyof BrdContent;
    const before = structuredClone(rec.brd.content[key]);
    try {
      rec.brd = { ...rec.brd, content: applyProposal(rec.brd.content, p), updatedAt: now() };
    } catch {
      continue;
    }
    p.status = "accepted";
    p.decidedBy = "BA agent";
    p.decidedAt = now();
    p.undo = { before, after: structuredClone(rec.brd.content[key]) };
  }
  syncDocument(rec);
}

function reply(rec: BrdRecord, out: AgentOut) {
  rec.seq = out.nextSeq;
  rec.thread.focus = out.focus;
  rec.thread.skipped = out.skipped;
  applyLive(rec, out.message.proposals);
  say(rec, "agent", out.message.text, {
    cites: out.message.cites,
    proposals: out.message.proposals,
    suggestions: out.message.suggestions,
    step: rec.thread.step,
  });
}

/** Runs the BA agent on one author message and appends its reply. */
function converse(
  rec: BrdRecord,
  text: string,
  opts: { attachments?: string[]; context?: ChatMessage["context"] } = {},
) {
  reply(
    rec,
    respond(agentInput(rec), text, { attachments: opts.attachments, context: opts.context ?? null }),
  );
}

/** The agent answers in a comment thread, proposing changes only while the BRD can be edited. */
function answerInThread(rec: BrdRecord, t: CommentThread, text: string) {
  const at = now();
  if (!editable(rec)) {
    t.messages.push({
      id: `CM${rec.seq++}`,
      author: "BA agent",
      role: "agent",
      at,
      text: "This version is locked while it's in review, so I can't propose edits here. When it reopens, ask me again and I'll suggest the change in place.",
      proposals: [],
    });
    return;
  }
  const out = respond(agentInput(rec), text.replace(/@(agent|ba agent|ba)\b/gi, "").trim(), {
    context: t.anchor,
    interview: false,
  });
  rec.seq = out.nextSeq;
  t.messages.push({
    id: `CM${rec.seq++}`,
    author: "BA agent",
    role: "agent",
    at,
    text: out.message.text,
    proposals: out.message.proposals,
  });
}

const blank = (): BrdContent => ({
  summary: "",
  problem: "",
  background: "",
  objectives: [],
  inScope: [],
  outOfScope: [],
  stakeholders: [],
  currentState: [],
  painPoints: [],
  futureState: [],
  requirements: [],
  rules: [],
  nfrs: [],
  data: [],
  assumptions: [],
  constraints: [],
  dependencies: [],
  risks: [],
  successCriteria: [],
  glossary: [],
  openQuestions: [],
});

function find(store: TenantSeed, id: unknown) {
  return store.brds.find((r) => r.brd.id === id);
}

export const studioHandlers = [
  http.get(`${T}/brds/:brdId/studio`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const body = NewBrd.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Choose a project and describe the BRD");
    const project = g.store.projects.find((p) => p.id === body.data.projectId);
    if (!project) return apiError(400, "invalid", "Choose a project for the BRD");
    const n = Math.max(0, ...g.store.brds.map((r) => Number(r.brd.id.replace(/\D/g, "")) || 0)) + 1;
    const id = `BRD-${n}`;
    const title = body.data.title ?? titleFrom(body.data.titleFrom ?? body.data.brief ?? "");
    // A BRD always belongs to a work item in its project; create one when none was given.
    let workItemKey = body.data.workItemKey ?? "";
    const existing = g.store.workItems.items.find((w) => w.key === workItemKey);
    if (existing && existing.projectId !== project.id)
      return apiError(400, "invalid", `${workItemKey} belongs to another project`);
    if (!existing) {
      const next =
        Math.max(0, ...g.store.workItems.items.map((w) => Number(w.key.replace(/\D/g, "")) || 0)) + 1;
      workItemKey = `INT-${next}`;
      g.store.workItems.items.unshift({
        id: workItemKey.toLowerCase(),
        key: workItemKey,
        projectId: project.id,
        title,
        team: project.teams[0] ?? "Unassigned",
        stage: "brd",
        risk: 1,
        waitingOn: { kind: "agent", label: "BA agent · drafting", gate: null },
        ageDays: 0,
        aiSpendUsd: 0,
      });
    }
    const jira = g.store.integrations.find((i) => i.id === "jira");
    const ado = g.store.integrations.find((i) => i.id === "azure-boards");
    const target = ado?.status === "connected" && jira?.status !== "connected" ? "azure-boards" : "jira";
    const rec: BrdRecord = {
      brd: {
        id,
        projectId: project.id,
        workItemKey,
        title,
        version: "0.1",
        status: "draft",
        owner: me(),
        author: `BA agent · with ${me()}`,
        submittedBy: null,
        updatedAt: now(),
        content: blank(),
        layout: defaultLayout(),
        customSections: [],
        body: buildBody(blank(), defaultLayout(), []),
        approvals: [
          {
            id: "ap-sponsor",
            capacity: "Business sponsor",
            name: "To be assigned",
            isMe: false,
            status: "pending",
            at: null,
            comment: null,
          },
          {
            id: "ap-po",
            capacity: "Product owner",
            name: me(),
            isMe: true,
            status: "pending",
            at: null,
            comment: null,
          },
          {
            id: "ap-compliance",
            capacity: "Compliance",
            name: "To be assigned",
            isMe: false,
            status: "pending",
            at: null,
            comment: null,
          },
        ],
        history: [{ version: "0.1", at: now(), by: me(), what: "Created in BRD Studio" }],
      },
      sources: [],
      thread: {
        brdId: id,
        agent: "simulated",
        autoApply: true,
        focus: null,
        step: null,
        skipped: [],
        messages: [],
      },
      comments: [],
      seq: 1,
      hints: {},
      backlog: {
        id: `bl-${id}`,
        brdId: id,
        brdVersion: "0.1",
        status: "none",
        progress: 0,
        generatedAt: null,
        target,
        project: target === "jira" ? (project.tools.jira ?? project.key) : project.name,
        targetConnected: (target === "jira" ? jira : ado)?.status === "connected",
        pushedAt: null,
        pushedBy: null,
        items: [],
      },
    };
    say(
      rec,
      "agent",
      "I'm the BA agent. Describe the change in your own words (who it's for, what's wrong today, what good looks like), or attach files, links and notes with + (or drop them on the chat) and tell me what to take from them. I propose every edit and cite where it came from; you decide what goes in.",
    );
    if (body.data.brief?.trim()) {
      say(rec, "user", body.data.brief.trim());
      converse(rec, body.data.brief.trim());
    } else {
      rec.thread.focus = "summary";
    }
    g.store.brds.push(rec);
    return HttpResponse.json(state(rec), { status: 201 });
  }),

  http.put(`${T}/brds/:brdId/document`, async ({ request, params }) => {
    await latency(120);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (!editable(rec)) return locked();
    const body = BrdDocUpdate.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", body.error.issues[0]?.message ?? "Invalid document");
    const prev = new Map(rec.brd.approvals.map((a) => [a.id, a]));
    // With a document, the server reads the content from it rather than trusting the client's copy.
    let derived = {
      content: body.data.content,
      layout: body.data.layout,
      customSections: body.data.customSections,
    };
    if (body.data.body) {
      const d = deriveFromBody(body.data.body, rec.brd.content);
      const content = BrdContent.safeParse(d.content);
      if (!content.success)
        return apiError(
          400,
          "invalid",
          `An item in the document is incomplete: ${content.error.issues[0]?.path.join(".")}`,
        );
      derived = { content: content.data, layout: d.layout, customSections: d.customSections };
    }
    rec.brd = {
      ...rec.brd,
      title: body.data.title,
      owner: body.data.owner,
      workItemKey: body.data.workItemKey,
      ...derived,
      ...(body.data.body ? { body: body.data.body } : {}),
      approvals: body.data.approvals.map((a) => {
        const old = prev.get(a.id);
        const renamed = old && old.name !== a.name;
        return {
          id: a.id,
          capacity: a.capacity,
          name: a.name,
          isMe: a.name === me(),
          status: old && !renamed ? old.status : "pending",
          at: old && !renamed ? old.at : null,
          comment: old && !renamed ? old.comment : null,
        };
      }),
      updatedAt: now(),
    };
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/messages`, async ({ request, params }) => {
    await latency(500);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (!editable(rec)) return locked();
    const body = PostMessage.safeParse(await request.json());
    if (!body.success)
      return apiError(400, "invalid", body.error.issues[0]?.message ?? "Message is empty or too long");
    const known = new Set(rec.sources.map((x) => x.id));
    const attachments = body.data.attachments.filter((id) => known.has(id));
    say(rec, "user", body.data.text, {
      step: rec.thread.step,
      attachments,
      context: body.data.context,
    });
    converse(rec, body.data.text, { attachments, context: body.data.context });
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/step`, async ({ request, params }) => {
    await latency(150);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    const body = SetStep.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Unknown step");
    if (rec.thread.step === body.data.step) return HttpResponse.json(state(rec));
    rec.thread.step = body.data.step;
    // Locked versions can still move between steps; the agent only talks while the BRD is editable.
    if (editable(rec)) reply(rec, enterStep(agentInput(rec), body.data.step));
    else rec.thread.focus = null;
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/capture`, async ({ request, params }) => {
    await latency(350);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (!editable(rec)) return locked();
    const body = Capture.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", body.error.issues[0]?.message ?? "Check the form");
    let out: ReturnType<typeof captureItem>;
    try {
      out = captureItem(agentInput(rec), body.data);
    } catch {
      return apiError(400, "invalid", "That entry doesn't fit the document");
    }
    rec.brd = { ...rec.brd, content: applyProposal(rec.brd.content, out.change), updatedAt: now() };
    syncDocument(rec);
    say(rec, "user", out.label, { step: rec.thread.step, capture: body.data });
    reply(rec, out);
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/proposals/:proposalId`, async ({ request, params }) => {
    await latency(100);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (!editable(rec)) return locked();
    const body = ProposalDecision.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "accept or reject");
    const ids =
      params.proposalId === "all"
        ? (body.data.decision === "undo"
            ? allProposals(rec)
                .filter((p) => p.status === "accepted" && p.undo)
                .reverse()
            : pending(rec)
          ).map((p) => p.id)
        : [String(params.proposalId)];
    const everything = allProposals(rec);
    for (const id of ids) {
      const p = everything.find((x) => x.id === id);
      if (!p) return apiError(404, "not_found", "No such proposal");
      if (body.data.decision === "undo") {
        if (p.status !== "accepted" || !p.undo) {
          if (ids.length === 1)
            return apiError(409, "conflict", "Only an edit the agent applied can be undone");
          continue;
        }
        const key = p.target as keyof BrdContent;
        const undone = undoField(rec.brd.content[key], p.undo.before, p.undo.after);
        if (!undone) {
          if (ids.length === 1)
            return apiError(409, "conflict", "That part has been edited since, so undo it by hand");
          continue;
        }
        const restored = BrdContent.safeParse({ ...rec.brd.content, [key]: undone.value });
        if (!restored.success) continue;
        rec.brd = { ...rec.brd, content: restored.data, updatedAt: now() };
        syncDocument(rec);
        p.status = "reverted";
        p.decidedBy = me();
        p.decidedAt = now();
        continue;
      }
      if (p.status !== "pending") continue;
      if (body.data.decision === "accept") {
        try {
          rec.brd = { ...rec.brd, content: applyProposal(rec.brd.content, p), updatedAt: now() };
          syncDocument(rec);
        } catch {
          if (ids.length === 1) return apiError(400, "invalid", "That change no longer fits the document");
          continue;
        }
      }
      p.status = body.data.decision === "accept" ? "accepted" : "rejected";
      p.decidedBy = me();
      p.decidedAt = now();
    }
    return HttpResponse.json(state(rec));
  }),

  http.get(`${T}/brds/:brdId/workspace-docs`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const docs = workspaceDocs(g.store, String(params.brdId)).map(({ text: _text, ...d }) => d);
    return HttpResponse.json(WorkspaceDocList.parse({ items: docs }));
  }),

  http.post(`${T}/brds/:brdId/sources`, async ({ request, params }) => {
    await latency(350);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    if (rec.sources.length >= 25) return apiError(409, "conflict", "25 sources is the limit for one BRD");
    const body = AddSource.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", body.error.issues[0]?.message ?? "Invalid source");
    const n = Math.max(0, ...rec.sources.map((s) => Number(s.id.slice(1)) || 0)) + 1;
    const src = readSource(`S${n}`, body.data, me(), workspaceDocs(g.store, rec.brd.id));
    rec.sources.push(src);
    if (editable(rec)) {
      const f = src.findings;
      say(
        rec,
        "agent",
        src.status === "ready"
          ? `I read ${src.id} “${src.title}”: ${src.passages.length} passages, ${f.needs} statements of need, ${f.numbers} with numbers, ${f.terms} defined terms. Want me to propose requirements from it?`
          : `${src.id} “${src.title}”: ${src.summary}`,
        {
          cites: [src.id],
          suggestions: src.status === "ready" ? [`Use ${src.id} for requirements`] : [],
        },
      );
    }
    return HttpResponse.json(state(rec), { status: 201 });
  }),

  http.delete(`${T}/brds/:brdId/sources/:sourceId`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    rec.sources = rec.sources.filter((s) => s.id !== params.sourceId);
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/comments`, async ({ request, params }) => {
    await latency(250);
    const g = guardComment(request, params.tenantId);
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    const body = NewComment.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", body.error.issues[0]?.message ?? "Invalid comment");
    if (rec.comments.length >= 200) return apiError(409, "conflict", "This BRD has too many comment threads");
    const t: CommentThread = {
      id: `C${rec.seq++}`,
      anchor: body.data.anchor,
      resolved: false,
      resolvedBy: null,
      messages: [
        { id: `CM${rec.seq++}`, author: me(), role: "human", at: now(), text: body.data.text, proposals: [] },
      ],
    };
    rec.comments.push(t);
    if (body.data.askAgent) answerInThread(rec, t, body.data.text);
    return HttpResponse.json(state(rec), { status: 201 });
  }),

  http.post(`${T}/brds/:brdId/comments/:commentId/replies`, async ({ request, params }) => {
    await latency(250);
    const g = guardComment(request, params.tenantId);
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    const t = rec?.comments.find((c) => c.id === params.commentId);
    if (!rec || !t) return apiError(404, "not_found", "No such comment");
    if (t.resolved) return apiError(409, "conflict", "Reopen the thread to reply");
    const body = CommentReply.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Reply is empty or too long");
    if (t.messages.length >= 100) return apiError(409, "conflict", "This thread is full; start a new one");
    t.messages.push({
      id: `CM${rec.seq++}`,
      author: me(),
      role: "human",
      at: now(),
      text: body.data.text,
      proposals: [],
    });
    if (body.data.askAgent) answerInThread(rec, t, body.data.text);
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/comments/:commentId/resolve`, async ({ request, params }) => {
    await latency(120);
    const g = guardComment(request, params.tenantId);
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    const t = rec?.comments.find((c) => c.id === params.commentId);
    if (!rec || !t) return apiError(404, "not_found", "No such comment");
    const body = ResolveComment.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "resolved must be true or false");
    t.resolved = body.data.resolved;
    t.resolvedBy = body.data.resolved ? me() : null;
    return HttpResponse.json(state(rec));
  }),

  http.post(`${T}/brds/:brdId/agent-mode`, async ({ request, params }) => {
    await latency(80);
    const g = guardTenant(request, params.tenantId, "brd.edit");
    if ("error" in g) return g.error;
    const rec = find(g.store, params.brdId);
    if (!rec) return apiError(404, "not_found", "No such BRD");
    const body = AgentMode.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "autoApply must be true or false");
    rec.thread.autoApply = body.data.autoApply;
    return HttpResponse.json(state(rec));
  }),
];
