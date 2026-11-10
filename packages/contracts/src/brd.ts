import { z } from "zod";

/* ── Business requirements document ─────────────────────────────────────────────────────────
 * Structured the way a senior BA writes one (BABOK-aligned): objectives with measurable KPIs,
 * scope, stakeholders (RACI), as-is / to-be, business requirements with MoSCoW priority and
 * acceptance criteria, business rules, non-functional needs, data, risks and open questions.
 * Every item has an id so the backlog can trace back to it.
 */

export const MoSCoW = z.enum(["must", "should", "could", "wont"]);
export type MoSCoW = z.infer<typeof MoSCoW>;
export const MOSCOW_LABEL: Record<MoSCoW, string> = {
  must: "Must",
  should: "Should",
  could: "Could",
  wont: "Won't (this release)",
};

export const Objective = z.object({
  id: z.string(),
  statement: z.string(),
  kpi: z.string(),
  baseline: z.string(),
  target: z.string(),
  /** Source passages this came from, e.g. "S2.3". */
  sources: z.array(z.string()).optional(),
});
export type Objective = z.infer<typeof Objective>;

export const Stakeholder = z.object({
  name: z.string(),
  role: z.string(),
  raci: z.enum(["R", "A", "C", "I"]),
  interest: z.string(),
});
export type Stakeholder = z.infer<typeof Stakeholder>;

export const ProcessStep = z.object({ actor: z.string(), step: z.string() });
export type ProcessStep = z.infer<typeof ProcessStep>;

export const BusinessRequirement = z.object({
  id: z.string(),
  title: z.string(),
  /** "The system shall …" in business language. */
  statement: z.string(),
  rationale: z.string(),
  priority: MoSCoW,
  /** Capability area; becomes the epic in the backlog. */
  area: z.string(),
  actor: z.string(),
  objective: z.string(),
  source: z.string(),
  acceptance: z.array(z.string()),
  /** Source passages this came from, e.g. "S2.3". */
  sources: z.array(z.string()).optional(),
});
export type BusinessRequirement = z.infer<typeof BusinessRequirement>;

export const BusinessRule = z.object({
  id: z.string(),
  statement: z.string(),
  source: z.string(),
  /** Source passages this came from, e.g. "S2.3". */
  sources: z.array(z.string()).optional(),
});
export type BusinessRule = z.infer<typeof BusinessRule>;

export const NonFunctional = z.object({
  id: z.string(),
  category: z.enum([
    "availability",
    "performance",
    "security",
    "compliance",
    "usability",
    "reporting",
    "data",
  ]),
  statement: z.string(),
  target: z.string(),
  /** Source passages this came from, e.g. "S2.3". */
  sources: z.array(z.string()).optional(),
});
export type NonFunctional = z.infer<typeof NonFunctional>;

export const DataItem = z.object({
  entity: z.string(),
  description: z.string(),
  classification: z.enum(["public", "internal", "confidential", "restricted"]),
  retention: z.string(),
});
export type DataItem = z.infer<typeof DataItem>;

export const BrdRisk = z.object({
  id: z.string(),
  description: z.string(),
  impact: z.enum(["high", "medium", "low"]),
  likelihood: z.enum(["high", "medium", "low"]),
  mitigation: z.string(),
  owner: z.string(),
  /** Source passages this came from, e.g. "S2.3". */
  sources: z.array(z.string()).optional(),
});
export type BrdRisk = z.infer<typeof BrdRisk>;

export const OpenQuestion = z.object({
  id: z.string(),
  question: z.string(),
  owner: z.string(),
  status: z.enum(["open", "resolved"]),
  answer: z.string().optional(),
});
export type OpenQuestion = z.infer<typeof OpenQuestion>;

export const BrdContent = z.object({
  summary: z.string(),
  problem: z.string(),
  background: z.string(),
  objectives: z.array(Objective),
  inScope: z.array(z.string()),
  outOfScope: z.array(z.string()),
  stakeholders: z.array(Stakeholder),
  currentState: z.array(ProcessStep),
  painPoints: z.array(z.string()),
  futureState: z.array(ProcessStep),
  requirements: z.array(BusinessRequirement),
  rules: z.array(BusinessRule),
  nfrs: z.array(NonFunctional),
  data: z.array(DataItem),
  assumptions: z.array(z.string()),
  constraints: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(BrdRisk),
  successCriteria: z.array(z.string()),
  glossary: z.array(z.object({ term: z.string(), definition: z.string() })),
  openQuestions: z.array(OpenQuestion),
});
export type BrdContent = z.infer<typeof BrdContent>;

export const BrdStatus = z.enum(["draft", "in-review", "changes-requested", "approved"]);
export type BrdStatus = z.infer<typeof BrdStatus>;
export const BRD_STATUS_LABEL: Record<BrdStatus, string> = {
  draft: "Draft",
  "in-review": "In review",
  "changes-requested": "Changes requested",
  approved: "Approved",
};

export const BrdApproval = z.object({
  id: z.string(),
  /** What this approver signs for, e.g. "Business sponsor". */
  capacity: z.string(),
  name: z.string(),
  /** Set when the approver is the signed-in user's account in this tenant. */
  isMe: z.boolean(),
  status: z.enum(["pending", "approved", "changes-requested"]),
  at: z.string().nullable(),
  comment: z.string().nullable(),
});
export type BrdApproval = z.infer<typeof BrdApproval>;

export const BrdEvent = z.object({
  version: z.string(),
  at: z.string(),
  by: z.string(),
  what: z.string(),
});
export type BrdEvent = z.infer<typeof BrdEvent>;

/** Section order, renamed titles, hidden sections and free-form sections the author added. */
export const BrdLayout = z.object({
  order: z.array(z.string()),
  titles: z.record(z.string(), z.string()),
  hidden: z.array(z.string()),
});
export type BrdLayout = z.infer<typeof BrdLayout>;

/** Built-in section ids, in their default order. Custom sections use ids starting with "custom-". */
export const BRD_SECTION_IDS = [
  "summary",
  "problem",
  "background",
  "objectives",
  "scope",
  "stakeholders",
  "current",
  "pain",
  "future",
  "requirements",
  "rules",
  "nfrs",
  "data",
  "context",
  "risks",
  "success",
  "glossary",
  "questions",
] as const;

export const defaultLayout = (): BrdLayout => ({ order: [...BRD_SECTION_IDS], titles: {}, hidden: [] });

export const CustomSection = z.object({ id: z.string(), title: z.string(), body: z.string() });
export type CustomSection = z.infer<typeof CustomSection>;

export const Brd = z.object({
  id: z.string(),
  projectId: z.string(),
  workItemKey: z.string(),
  title: z.string(),
  version: z.string(),
  status: BrdStatus,
  owner: z.string(),
  author: z.string(),
  submittedBy: z.string().nullable(),
  updatedAt: z.string(),
  content: BrdContent,
  layout: BrdLayout,
  customSections: z.array(CustomSection),
  /**
   * The document as written in the editor (rich-text JSON with smart blocks). Absent for BRDs made
   * before the editor existed; the editor builds one from the content. See brdDoc.ts.
   */
  body: z.unknown().optional(),
  approvals: z.array(BrdApproval),
  history: z.array(BrdEvent),
});
export type Brd = z.infer<typeof Brd>;
export const BrdList = z.object({ items: z.array(Brd) });
export type BrdList = z.infer<typeof BrdList>;

export const BrdDecision = z.object({
  approvalId: z.string(),
  decision: z.enum(["approve", "request-changes"]),
  comment: z.string().max(1000).optional(),
});
export type BrdDecision = z.infer<typeof BrdDecision>;

/* ── Quality checks ─────────────────────────────────────────────────────────────────────────── */

export type BrdCheck = {
  id: string;
  severity: "error" | "warning";
  section: string;
  /** Item the check is about, e.g. "BR-04". */
  target: string | null;
  message: string;
};

/** Words that make a requirement untestable unless they come with a number. */
const VAGUE = [
  "fast",
  "quickly",
  "easy",
  "user-friendly",
  "intuitive",
  "seamless",
  "efficient",
  "robust",
  "as soon as possible",
  "etc",
  "and/or",
  "appropriate",
  "flexible",
  "minimal",
];

const hasNumber = (s: string) => /\d/.test(s);

/**
 * Lints a BRD the way a reviewing BA would. Errors block submission for approval; warnings are
 * shown to approvers. The same rules run in the editor and on the server.
 */
export function checkBrd(c: BrdContent): BrdCheck[] {
  const out: BrdCheck[] = [];
  const add = (severity: BrdCheck["severity"], section: string, target: string | null, message: string) =>
    out.push({ id: `${section}:${target ?? "-"}:${out.length}`, severity, section, target, message });

  if (c.summary.trim().length < 40)
    add("error", "summary", null, "Executive summary is missing or too short.");
  if (c.problem.trim().length < 40)
    add("error", "problem", null, "Problem statement is missing or too short.");
  if (c.objectives.length === 0) add("error", "objectives", null, "Add at least one business objective.");
  for (const o of c.objectives) {
    if (!o.kpi || !o.target)
      add("error", "objectives", o.id, `${o.id} has no KPI or target, so success can't be measured.`);
    else if (!hasNumber(o.target))
      add("warning", "objectives", o.id, `${o.id} target "${o.target}" has no number.`);
  }
  if (c.inScope.length === 0) add("error", "scope", null, "In-scope list is empty.");
  if (c.outOfScope.length === 0)
    add(
      "warning",
      "scope",
      null,
      "Nothing is listed as out of scope; reviewers will assume everything is in.",
    );
  if (!c.stakeholders.some((s) => s.raci === "A"))
    add("error", "stakeholders", null, "No stakeholder is Accountable (A).");
  if (c.requirements.length === 0) add("error", "requirements", null, "No business requirements yet.");

  const ids = new Set<string>();
  const objectiveIds = new Set(c.objectives.map((o) => o.id));
  for (const r of c.requirements) {
    if (ids.has(r.id)) add("error", "requirements", r.id, `${r.id} is used twice.`);
    ids.add(r.id);
    if (r.acceptance.filter((a) => a.trim()).length === 0)
      add("error", "requirements", r.id, `${r.id} has no acceptance criteria.`);
    if (!objectiveIds.has(r.objective))
      add("warning", "requirements", r.id, `${r.id} is not linked to a business objective.`);
    const text = `${r.statement} ${r.acceptance.join(" ")}`.toLowerCase();
    const vague = VAGUE.filter((w) => new RegExp(`\\b${w.replace("/", "\\/")}\\b`).test(text));
    if (vague.length > 0 && !hasNumber(text))
      add(
        "warning",
        "requirements",
        r.id,
        `${r.id} uses vague wording (${vague.join(", ")}) without a measurable target.`,
      );
    if (!r.source.trim()) add("warning", "requirements", r.id, `${r.id} has no source (who asked for it).`);
    if (r.statement.length > 400)
      add("warning", "requirements", r.id, `${r.id} is long; it may be several requirements.`);
  }
  for (const n of c.nfrs) {
    if (!hasNumber(n.target)) add("warning", "nfrs", n.id, `${n.id} target "${n.target}" is not measurable.`);
  }
  if (c.data.some((d) => d.classification === "restricted") && !c.nfrs.some((n) => n.category === "security"))
    add("error", "nfrs", null, "Restricted data is in scope but there is no security requirement.");
  for (const r of c.risks)
    if (!r.mitigation.trim()) add("warning", "risks", r.id, `${r.id} has no mitigation.`);
  for (const q of c.openQuestions)
    if (q.status === "open") add("warning", "questions", q.id, `${q.id} is still open: ${q.question}`);
  return out;
}

/** 0–100: how ready the BRD is for approval. Errors weigh more than warnings. */
export function brdScore(checks: BrdCheck[]): number {
  const e = checks.filter((c) => c.severity === "error").length;
  const w = checks.length - e;
  return Math.max(0, 100 - e * 15 - w * 4);
}

/* ── Backlog ────────────────────────────────────────────────────────────────────────────────── */

export const BacklogType = z.enum(["epic", "feature", "story", "subtask"]);
export type BacklogType = z.infer<typeof BacklogType>;

export const IssuePriority = z.enum(["highest", "high", "medium", "low"]);
export type IssuePriority = z.infer<typeof IssuePriority>;

export const Criterion = z.object({
  given: z.string(),
  when: z.string(),
  // biome-ignore lint/suspicious/noThenProperty: Given/When/Then is the domain language; criteria are never awaited
  then: z.string(),
});
export type Criterion = z.infer<typeof Criterion>;

/** What kind of work an item is: business value, platform enabler, compliance, go-live transition or a time-boxed spike. */
export const BacklogKind = z.enum(["business", "enabler", "compliance", "transition", "spike"]);
export type BacklogKind = z.infer<typeof BacklogKind>;

/** Sub-task discipline, used for capacity planning and the tool's Activity field. */
export const TaskKind = z.enum(["design", "build", "data", "test", "security", "devops", "docs", "change"]);
export type TaskKind = z.infer<typeof TaskKind>;

export const TestScenario = z.object({
  kind: z.enum(["happy", "negative", "edge", "nfr"]),
  scenario: z.string(),
});
export type TestScenario = z.infer<typeof TestScenario>;

export const BacklogOutcome = z.object({
  objective: z.string(),
  kpi: z.string(),
  baseline: z.string(),
  target: z.string(),
});
export type BacklogOutcome = z.infer<typeof BacklogOutcome>;

export const BacklogItem = z.object({
  id: z.string(),
  type: BacklogType,
  kind: BacklogKind.default("business"),
  parentId: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  /** User story parts, on stories only. */
  story: z.object({ asA: z.string(), iWant: z.string(), soThat: z.string() }).nullable(),
  acceptance: z.array(Criterion),
  priority: IssuePriority,
  points: z.number().nullable(),
  labels: z.array(z.string()),
  components: z.array(z.string()),
  iteration: z.string().nullable(),
  /** BRD ids this item delivers: BR-…, RULE-…, NFR-…. */
  traces: z.array(z.string()),
  dependsOn: z.array(z.string()),
  external: z.object({ key: z.string(), url: z.string() }).nullable(),
  /** Release the item is planned for, e.g. "MVP", "Release 2". */
  release: z.string().nullable().default(null),
  /** Accountable team or person. */
  owner: z.string().default(""),
  /** Epics and features: the benefit hypothesis. */
  businessValue: z.string().default(""),
  /** Epics: the objectives and KPIs it moves. */
  outcomes: z.array(BacklogOutcome).default([]),
  /** Epics and features: business acceptance criteria (stories use Given/When/Then). */
  criteria: z.array(z.string()).default([]),
  /** Epics: what's in and out. */
  scope: z
    .object({ in: z.array(z.string()), out: z.array(z.string()) })
    .nullable()
    .default(null),
  /** Non-functional requirements (NFR-…) the item must meet. */
  nfrs: z.array(z.string()).default([]),
  /** Business rules (RULE-…) the item enforces. */
  rules: z.array(z.string()).default([]),
  /** Data it touches, with its classification. */
  data: z.array(z.object({ entity: z.string(), classification: z.string() })).default([]),
  /** BRD risks (R-…) it carries or mitigates. */
  risks: z.array(z.string()).default([]),
  /** Test scenarios: the acceptance criteria plus negative, edge and NFR checks. */
  tests: z.array(TestScenario).default([]),
  /** Item-specific definition-of-done additions (the team's DoD always applies). */
  definitionOfDone: z.array(z.string()).default([]),
  /** Assumptions, implementation notes, open points. */
  notes: z.array(z.string()).default([]),
  /** Sub-tasks: discipline and estimate in hours. */
  taskKind: TaskKind.nullable().default(null),
  hours: z.number().nullable().default(null),
});
export type BacklogItem = z.infer<typeof BacklogItem>;

/** Team-wide Definition of Ready: a story can enter a sprint only when all of these hold. */
export const DEFINITION_OF_READY = [
  "Written as a user story with a clear actor, need and benefit",
  "Acceptance criteria in Given / When / Then, including negative cases",
  "Traced to a BRD requirement (and rules / NFRs where they apply)",
  "Estimated at 8 points or less",
  "Dependencies identified and not blocking the sprint",
  "Test scenarios agreed with QA",
  "Data classification and security impact known",
] as const;

/** Team-wide Definition of Done: applies to every story on top of its own additions. */
export const DEFINITION_OF_DONE = [
  "Code peer-reviewed and merged to main",
  "Automated tests for every acceptance criterion pass in CI",
  "No new critical or high security findings (SAST / dependency scan)",
  "Non-functional targets that apply are verified",
  "Deployed to the test environment and accepted by the product owner",
  "Audit logging, monitoring and alerts in place where the story changes data",
  "Runbook, API docs and release notes updated",
] as const;

export const BACKLOG_KIND_LABEL: Record<BacklogKind, string> = {
  business: "Business",
  enabler: "Enabler",
  compliance: "Compliance",
  transition: "Transition",
  spike: "Spike",
};
export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  design: "Design",
  build: "Build",
  data: "Data",
  test: "Test",
  security: "Security",
  devops: "DevOps",
  docs: "Documentation",
  change: "Change management",
};

export const BacklogTarget = z.enum(["jira", "azure-boards"]);
export type BacklogTarget = z.infer<typeof BacklogTarget>;

export const Backlog = z.object({
  id: z.string(),
  brdId: z.string(),
  brdVersion: z.string(),
  status: z.enum(["none", "generating", "ready", "stale"]),
  progress: z.number(),
  generatedAt: z.string().nullable(),
  target: BacklogTarget,
  project: z.string(),
  targetConnected: z.boolean(),
  pushedAt: z.string().nullable(),
  pushedBy: z.string().nullable(),
  items: z.array(BacklogItem),
});
export type Backlog = z.infer<typeof Backlog>;
export const BacklogList = z.object({ items: z.array(Backlog) });
export type BacklogList = z.infer<typeof BacklogList>;

export const BacklogItemPatch = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().max(5000).optional(),
  priority: IssuePriority.optional(),
  points: z.number().int().min(0).max(40).nullable().optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  acceptance: z.array(Criterion).max(20).optional(),
  iteration: z.string().nullable().optional(),
});
export type BacklogItemPatch = z.infer<typeof BacklogItemPatch>;

/** How the neutral hierarchy lands in each tool. */
export const TOOL_TYPES: Record<BacklogTarget, Record<BacklogType, string>> = {
  jira: { epic: "Epic", feature: "Label on its stories", story: "Story", subtask: "Sub-task" },
  "azure-boards": { epic: "Epic", feature: "Feature", story: "User Story", subtask: "Task" },
};
/** Whether an item becomes its own work item in the tool (Jira has no Feature level by default). */
export const isPushable = (target: BacklogTarget, item: Pick<BacklogItem, "type">) =>
  !(target === "jira" && item.type === "feature");

export const TOOL_LABEL: Record<BacklogTarget, string> = { jira: "Jira", "azure-boards": "Azure Boards" };

export const POINTS = [1, 2, 3, 5, 8, 13] as const;
/** Story points the sprint plan fills a sprint to. */
export const SPRINT_CAPACITY = 30;

export type StoryCheck = { id: string; message: string };

/** Definition of Ready / INVEST checks for one story. */
export function storyChecks(item: BacklogItem): StoryCheck[] {
  if (item.type !== "story") return [];
  const out: StoryCheck[] = [];
  if (item.acceptance.length === 0) out.push({ id: "ac", message: "No acceptance criteria." });
  if (item.points === null) out.push({ id: "est", message: "Not estimated." });
  else if (item.points > 8)
    out.push({ id: "size", message: `${item.points} points is too big for one sprint; split it.` });
  if (item.traces.length === 0) out.push({ id: "trace", message: "Not traced to a BRD requirement." });
  if (!item.story) out.push({ id: "fmt", message: "Not written as a user story." });
  if (item.acceptance.length > 0 && item.tests.length === 0)
    out.push({ id: "tests", message: "No test scenarios." });
  return out;
}

/** Share of Must requirements that at least one story delivers. */
export function mustCoverage(brd: Pick<BrdContent, "requirements">, items: BacklogItem[]) {
  const musts = brd.requirements.filter((r) => r.priority === "must");
  const traced = new Set(items.filter((i) => i.type === "story").flatMap((i) => i.traces));
  const covered = musts.filter((r) => traced.has(r.id));
  return {
    total: musts.length,
    covered: covered.length,
    missing: musts.filter((r) => !traced.has(r.id)).map((r) => r.id),
  };
}
