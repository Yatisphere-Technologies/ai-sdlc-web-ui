import {
  NewTestPlan,
  PushTestPlan,
  TEST_TOOL_LABEL,
  TestCasePatch,
  type TestPlan,
  TestPlanDecision,
  TestPlanList,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { getSession } from "./db";
import { apiError, guardTenant } from "./guard";
import { applyRun, generateTestPlan, refresh } from "./qa/generate";
import { pushPlan } from "./qa/seed";
import type { TenantSeed } from "./seed/types";

const T = "/api/t/:tenantId";
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(220));
const me = () => getSession().user.name;
const now = () => new Date().toISOString();

/** What a project's test plan is built from right now. */
function inputs(store: TenantSeed, projectId: string) {
  const recs = store.brds.filter((r) => r.brd.projectId === projectId);
  const rec = recs.find((r) => r.brd.status === "approved") ?? recs[0];
  const architecture =
    store.architectures.find(
      (a) => a.architecture.projectId === projectId && a.architecture.workItemKey === rec?.brd.workItemKey,
    )?.architecture ??
    store.architectures.find((a) => a.architecture.projectId === projectId)?.architecture ??
    null;
  return { rec, architecture };
}

/** A plan whose BRD version or architecture revision moved on is out of date until regenerated. */
function current(store: TenantSeed, tp: TestPlan): TestPlan {
  const brd = tp.basis.brd ? store.brds.find((r) => r.brd.id === tp.basis.brd?.id)?.brd : undefined;
  const arch = tp.basis.architecture
    ? store.architectures.find((a) => a.architecture.id === tp.basis.architecture?.id)?.architecture
    : undefined;
  const moved =
    (brd && tp.basis.brd && brd.version !== tp.basis.brd.version) ||
    (arch && tp.basis.architecture && arch.revision !== tp.basis.architecture.revision);
  return moved && tp.status !== "stale" ? { ...tp, status: "stale" } : tp;
}

const list = (store: TenantSeed) => {
  store.testPlans = store.testPlans.map((tp) => current(store, tp));
  return TestPlanList.parse({ items: store.testPlans });
};

const bump = (v: string) => {
  const [a = "0", b = "0"] = v.split(".");
  return `${a}.${Number(b) + 1}`;
};

function build(store: TenantSeed, projectId: string, previous?: TestPlan): TestPlan | null {
  const project = store.projects.find((p) => p.id === projectId);
  if (!project) return null;
  const { rec, architecture } = inputs(store, projectId);
  const jira = store.integrations.find((i) => i.id === "jira")?.status === "connected";
  const fresh = generateTestPlan({
    project,
    brd: rec?.brd ?? null,
    backlog: rec && rec.backlog.status !== "none" ? rec.backlog : null,
    architecture,
    plan: store.plans.find((p) => p.projectId === projectId) ?? null,
    // Keep the QA lead's authored cases (work items without a BRD) across regeneration.
    authored: previous?.cases
      .filter((c) => c.traces.some((t) => t.kind === "work-item"))
      .map((c) => ({
        title: c.title,
        level: c.level,
        priority: c.priority,
        workItem: c.traces.find((t) => t.kind === "work-item")?.id ?? "",
        steps: c.steps.map((s) => [s.action, s.expected] as [string, string]),
        tool: c.tool,
        automated: c.automated,
      })),
    target: previous?.target ?? (jira ? "xray" : "azure-test-plans"),
    owner: previous?.owner ?? me(),
    at: now(),
  });
  return previous
    ? {
        ...fresh,
        version: bump(previous.version),
        history: [
          ...previous.history,
          {
            version: bump(previous.version),
            at: now(),
            by: me(),
            what: `Regenerated: ${fresh.cases.length} cases`,
          },
        ],
      }
    : fresh;
}

const find = (store: TenantSeed, id: unknown) => store.testPlans.find((x) => x.id === id);
const save = (store: TenantSeed, tp: TestPlan) => {
  store.testPlans = store.testPlans.map((x) => (x.id === tp.id ? tp : x));
};
const brdOf = (store: TenantSeed, tp: TestPlan) =>
  tp.basis.brd ? (store.brds.find((r) => r.brd.id === tp.basis.brd?.id)?.brd ?? null) : null;
const archOf = (store: TenantSeed, tp: TestPlan) =>
  tp.basis.architecture
    ? (store.architectures.find((a) => a.architecture.id === tp.basis.architecture?.id)?.architecture ?? null)
    : null;

export const testHandlers = [
  http.get(`${T}/test-plans`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(list(g.store));
  }),

  http.post(`${T}/test-plans`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const body = NewTestPlan.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Choose a project");
    if (g.store.testPlans.some((x) => x.projectId === body.data.projectId))
      return apiError(409, "conflict", "This project already has a test plan; regenerate it instead");
    const tp = build(g.store, body.data.projectId);
    if (!tp) return apiError(400, "invalid", "No such project");
    g.store.testPlans.push(tp);
    return HttpResponse.json(list(g.store), { status: 201 });
  }),

  http.post(`${T}/test-plans/:planId/generate`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const prev = find(g.store, params.planId);
    if (!prev) return apiError(404, "not_found", "No such test plan");
    const tp = build(g.store, prev.projectId, prev);
    if (!tp) return apiError(400, "invalid", "The project no longer exists");
    save(g.store, tp);
    return HttpResponse.json(list(g.store));
  }),

  http.post(`${T}/test-plans/:planId/decision`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const tp = find(g.store, params.planId);
    if (!tp) return apiError(404, "not_found", "No such test plan");
    const body = TestPlanDecision.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Say what you decided");
    const live = current(g.store, tp);
    if (live.status === "stale")
      return apiError(409, "conflict", "The plan is out of date. Regenerate it first.");
    if (body.data.decision === "submit") {
      if (live.status !== "draft") return apiError(409, "conflict", "Only a draft can be submitted");
      save(g.store, {
        ...live,
        status: "in-review",
        history: [
          ...live.history,
          { version: live.version, at: now(), by: me(), what: "Submitted for approval" },
        ],
      });
      return HttpResponse.json(list(g.store));
    }
    if (live.status !== "in-review") return apiError(409, "conflict", "Submit the plan before approving it");
    const slot = live.approvals.find((a) => a.id === body.data.approvalId);
    if (!slot || slot.status === "approved")
      return apiError(400, "invalid", "No pending approval with that id");
    const approvals = live.approvals.map((a) =>
      a.id === slot.id ? { ...a, status: "approved" as const, at: now() } : a,
    );
    const done = approvals.every((a) => a.status === "approved");
    const major = Number(live.version.split(".")[0] ?? 0);
    const version = done ? `${major + 1}.0` : live.version;
    save(g.store, {
      ...live,
      approvals,
      status: done ? "approved" : "in-review",
      version,
      cases: done
        ? live.cases.map((c) => (c.status === "retired" ? c : { ...c, status: "approved" }))
        : live.cases,
      history: [
        ...live.history,
        {
          version,
          at: now(),
          by: me(),
          what: done ? "Approved by all approvers" : `${slot.capacity} approved`,
        },
      ],
    });
    return HttpResponse.json(list(g.store));
  }),

  http.patch(`${T}/test-plans/:planId/cases/:caseId`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const tp = find(g.store, params.planId);
    if (!tp) return apiError(404, "not_found", "No such test plan");
    const body = TestCasePatch.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Invalid change");
    if (!tp.cases.some((c) => c.id === params.caseId)) return apiError(404, "not_found", "No such case");
    const next = refresh(
      { ...tp, cases: tp.cases.map((c) => (c.id === params.caseId ? { ...c, ...body.data } : c)) },
      brdOf(g.store, tp),
      archOf(g.store, tp),
    );
    save(g.store, next);
    return HttpResponse.json(list(g.store));
  }),

  http.post(`${T}/test-plans/:planId/push`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const tp = find(g.store, params.planId);
    if (!tp) return apiError(404, "not_found", "No such test plan");
    const body = PushTestPlan.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Choose a test tool");
    if (current(g.store, tp).status !== "approved")
      return apiError(409, "conflict", "Approve the plan before pushing it");
    const needs = body.data.target === "azure-test-plans" ? "azure-boards" : "jira";
    if (g.store.integrations.find((i) => i.id === needs)?.status !== "connected")
      return apiError(
        409,
        "conflict",
        `${TEST_TOOL_LABEL[body.data.target]} needs ${needs === "jira" ? "Jira" : "Azure DevOps"} connected in Settings → Integrations`,
      );
    const project = g.store.projects.find((p) => p.id === tp.projectId);
    save(g.store, pushPlan(tp, body.data.target, project?.tools.jira ?? project?.key ?? "TEST", now()));
    return HttpResponse.json(list(g.store));
  }),

  /** Stand-in for CI reporting results (JUnit, Playwright, k6) against the plan's case ids. */
  http.post(`${T}/test-plans/:planId/runs`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const tp = find(g.store, params.planId);
    if (!tp) return apiError(404, "not_found", "No such test plan");
    if (current(g.store, tp).status !== "approved")
      return apiError(409, "conflict", "Run tests against an approved plan");
    const project = g.store.projects.find((p) => p.id === tp.projectId);
    const n = tp.runs.length + 1;
    const ran = applyRun(tp, {
      id: `ci-${tp.id}-${n}`,
      at: now(),
      source: `CI · ${project?.tools.repo ?? project?.key ?? "pipeline"} run ${100 + n}`,
      environment: "Test",
      executed: Math.min(1, 0.6 + n * 0.15),
      pass: 0.93,
      defectPrefix: project?.tools.jira ?? project?.key ?? "BUG",
    });
    save(g.store, refresh(ran, brdOf(g.store, tp), archOf(g.store, tp)));
    return HttpResponse.json(list(g.store));
  }),
];
