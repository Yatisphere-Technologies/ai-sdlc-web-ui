import { z } from "zod";

/* ── Test plans ──────────────────────────────────────────────────────────────────────────────────
 * One test plan per project, structured after ISO/IEC/IEEE 29119-3: scope, approach per level,
 * environments, test data, risks, entry/exit criteria, schedule, roles, tools, and the test cases.
 * The QA agent drafts it from the approved BRD, the backlog, the architecture and the project
 * plan; every case traces back to what it proves (requirement, NFR, rule, story, control,
 * component). It is pushed to the team's test tool and results come back from CI.
 */

export const TestLevel = z.enum([
  "unit",
  "contract",
  "integration",
  "system",
  "e2e",
  "uat",
  "performance",
  "security",
  "resilience",
  "accessibility",
  "ai-eval",
  "data",
]);
export type TestLevel = z.infer<typeof TestLevel>;
export const TEST_LEVEL_LABEL: Record<TestLevel, string> = {
  unit: "Unit",
  contract: "Contract",
  integration: "Integration",
  system: "System",
  e2e: "End-to-end",
  uat: "User acceptance",
  performance: "Performance",
  security: "Security",
  resilience: "Resilience and DR",
  accessibility: "Accessibility",
  "ai-eval": "AI evaluation",
  data: "Data and privacy",
};

export const TestPriority = z.enum(["P1", "P2", "P3"]);
export type TestPriority = z.infer<typeof TestPriority>;

export const TestResult = z.enum(["pass", "fail", "blocked", "not-run"]);
export type TestResult = z.infer<typeof TestResult>;

export const TestTrace = z.object({
  kind: z.enum([
    "requirement",
    "nfr",
    "rule",
    "objective",
    "story",
    "control",
    "component",
    "risk",
    "work-item",
  ]),
  id: z.string(),
  label: z.string(),
});
export type TestTrace = z.infer<typeof TestTrace>;

export const TestStep = z.object({ action: z.string(), expected: z.string() });

export const TestTool = z.enum(["xray", "zephyr", "azure-test-plans"]);
export type TestTool = z.infer<typeof TestTool>;
export const TEST_TOOL_LABEL: Record<TestTool, string> = {
  xray: "Xray (Jira)",
  zephyr: "Zephyr Scale (Jira)",
  "azure-test-plans": "Azure Test Plans",
};

export const TestCase = z.object({
  id: z.string(),
  title: z.string(),
  level: TestLevel,
  priority: TestPriority,
  /** How bad it is if this fails in production. */
  risk: z.enum(["high", "medium", "low"]),
  objective: z.string(),
  preconditions: z.array(z.string()),
  steps: z.array(TestStep),
  data: z.string(),
  automated: z.boolean(),
  /** Framework or tool that runs it, e.g. "Playwright", "k6", "OWASP ZAP", "Manual". */
  tool: z.string(),
  traces: z.array(TestTrace),
  status: z.enum(["draft", "ready", "approved", "retired"]),
  result: TestResult,
  lastRunAt: z.string().nullable(),
  defects: z.array(z.string()),
  /** Key in the test tool once pushed, e.g. "SUP-T12" or "48213". */
  external: z.string().nullable(),
});
export type TestCase = z.infer<typeof TestCase>;

export const TestApproach = z.object({
  level: TestLevel,
  objective: z.string(),
  owner: z.string(),
  tools: z.array(z.string()),
  environment: z.string(),
  automationTarget: z.number().min(0).max(100),
});
export type TestApproach = z.infer<typeof TestApproach>;

export const ExitCriterion = z.object({
  id: z.string(),
  criterion: z.string(),
  target: z.string(),
  /** Measured value, or null before any run. */
  actual: z.string().nullable(),
  met: z.boolean().nullable(),
});
export type ExitCriterion = z.infer<typeof ExitCriterion>;

export const TestRun = z.object({
  id: z.string(),
  at: z.string(),
  source: z.string(),
  environment: z.string(),
  passed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  notRun: z.number().int().nonnegative(),
  durationMin: z.number().nonnegative(),
});
export type TestRun = z.infer<typeof TestRun>;

export const TestPlanApproval = z.object({
  id: z.string(),
  capacity: z.string(),
  name: z.string(),
  status: z.enum(["pending", "approved"]),
  at: z.string().nullable(),
});

export const TestCoverage = z.object({
  requirements: z.object({ covered: z.number(), total: z.number() }),
  nfrs: z.object({ covered: z.number(), total: z.number() }),
  controls: z.object({ covered: z.number(), total: z.number() }),
  automation: z.number().min(0).max(100),
  passRate: z.number().min(0).max(100).nullable(),
  executed: z.number().min(0).max(100),
});
export type TestCoverage = z.infer<typeof TestCoverage>;

export const TestPlan = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  version: z.string(),
  status: z.enum(["draft", "in-review", "approved", "stale"]),
  owner: z.string(),
  /** What it was generated from; a change to any of them makes the plan stale. */
  basis: z.object({
    brd: z.object({ id: z.string(), version: z.string() }).nullable(),
    architecture: z.object({ id: z.string(), revision: z.number() }).nullable(),
    backlog: z.string().nullable(),
  }),
  summary: z.string(),
  scope: z.object({ in: z.array(z.string()), out: z.array(z.string()) }),
  approach: z.array(TestApproach),
  environments: z.array(
    z.object({ name: z.string(), purpose: z.string(), where: z.string(), data: z.string() }),
  ),
  testData: z.array(z.object({ entity: z.string(), classification: z.string(), approach: z.string() })),
  risks: z.array(z.object({ id: z.string(), risk: z.string(), impact: z.string(), mitigation: z.string() })),
  entry: z.array(z.string()),
  exit: z.array(ExitCriterion),
  schedule: z.array(
    z.object({ phase: z.string(), start: z.string(), end: z.string(), milestone: z.string().nullable() }),
  ),
  roles: z.array(z.object({ role: z.string(), name: z.string(), responsibilities: z.string() })),
  defects: z.object({
    tool: z.string(),
    severities: z.array(z.object({ level: z.string(), meaning: z.string(), sla: z.string() })),
  }),
  cases: z.array(TestCase),
  runs: z.array(TestRun),
  coverage: TestCoverage,
  approvals: z.array(TestPlanApproval),
  target: TestTool,
  pushedAt: z.string().nullable(),
  generatedAt: z.string(),
  history: z.array(z.object({ version: z.string(), at: z.string(), by: z.string(), what: z.string() })),
});
export type TestPlan = z.infer<typeof TestPlan>;

export const TestPlanList = z.object({ items: z.array(TestPlan) });
export type TestPlanList = z.infer<typeof TestPlanList>;

/* ── Writes ───────────────────────────────────────────────────────────────────────────────────── */

export const NewTestPlan = z.object({ projectId: z.string().min(1) });
export const TestPlanDecision = z.object({
  decision: z.enum(["submit", "approve"]),
  approvalId: z.string().optional(),
});
export const TestCasePatch = z.object({
  status: TestCase.shape.status.optional(),
  priority: TestPriority.optional(),
  automated: z.boolean().optional(),
});
export const PushTestPlan = z.object({ target: TestTool });
