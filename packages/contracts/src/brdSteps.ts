import { z } from "zod";
import { type BrdContent, checkBrd, MoSCoW } from "./brd";

/* ── Guided BRD flow ───────────────────────────────────────────────────────────────────────────
 * The BRD is written in eight steps. Each step owns some sections, has a goal, and has exit checks:
 * "required" ones mirror the blocking quality checks (so a BRD whose required checks all pass can be
 * submitted), "recommended" ones are what a good BA would still expect. Steps can be visited in any
 * order; only sign-off waits for the required checks.
 */

export const BRD_STEP_IDS = [
  "context",
  "problem",
  "scope",
  "process",
  "requirements",
  "quality",
  "risks",
  "review",
] as const;
export const BrdStepId = z.enum(BRD_STEP_IDS);
export type BrdStepId = z.infer<typeof BrdStepId>;

export type BrdStep = {
  id: BrdStepId;
  title: string;
  goal: string;
  /** Document sections this step fills (ids from BRD_SECTION_IDS). */
  sections: string[];
  /** Agent focus keys (BrdContent keys) this step asks about, in order. */
  focuses: string[];
  /** Structured capture forms offered in this step, first is the default. */
  captures: CaptureKind[];
};

export const CAPTURE_KINDS = [
  "text",
  "objective",
  "success",
  "scope",
  "stakeholder",
  "process",
  "pain",
  "requirement",
  "rule",
  "nfr",
  "data",
  "risk",
  "note",
  "term",
  "question",
] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];

export const BRD_STEPS: BrdStep[] = [
  {
    id: "context",
    title: "Context",
    goal: "What we're doing, for whom, and why now. Attach notes, documents and links as you go.",
    sections: ["summary", "background"],
    focuses: ["summary", "background"],
    captures: ["text"],
  },
  {
    id: "problem",
    title: "Problem & outcomes",
    goal: "The problem in measurable terms and the outcomes that define success.",
    sections: ["problem", "objectives", "success"],
    focuses: ["problem", "objectives", "successCriteria"],
    captures: ["objective", "text", "success"],
  },
  {
    id: "scope",
    title: "Scope & people",
    goal: "What's in, what's explicitly out, and who decides, does, and is consulted.",
    sections: ["scope", "stakeholders"],
    focuses: ["inScope", "outOfScope", "stakeholders"],
    captures: ["scope", "stakeholder"],
  },
  {
    id: "process",
    title: "Today & tomorrow",
    goal: "How the work happens now, where it hurts, and how it should work.",
    sections: ["current", "pain", "future"],
    focuses: ["currentState", "painPoints", "futureState"],
    captures: ["process", "pain"],
  },
  {
    id: "requirements",
    title: "Requirements",
    goal: "What the solution must let people do, each with acceptance criteria and a priority.",
    sections: ["requirements", "rules"],
    focuses: ["requirements", "acceptance", "rules"],
    captures: ["requirement", "rule"],
  },
  {
    id: "quality",
    title: "Quality & data",
    goal: "Measurable non-functional targets and the data the change touches.",
    sections: ["nfrs", "data"],
    focuses: ["nfrs", "data"],
    captures: ["nfr", "data"],
  },
  {
    id: "risks",
    title: "Risks & constraints",
    goal: "What could stop it, what we assume, depend on and must live with, and what's still open.",
    sections: ["context", "risks", "glossary", "questions"],
    focuses: ["risks", "assumptions", "constraints", "dependencies"],
    captures: ["risk", "note", "term", "question"],
  },
  {
    id: "review",
    title: "Review",
    goal: "Clear every blocking check and tighten wording before it goes to approvers.",
    sections: [],
    focuses: [],
    captures: [],
  },
];

export const stepOf = (id: string): BrdStep =>
  BRD_STEPS.find((s) => s.id === id) ?? (BRD_STEPS[0] as BrdStep);

/** Step that owns an agent focus key ("acceptance:BR-03" belongs to requirements). */
export function stepForFocus(focus: string): BrdStepId | null {
  const key = focus.startsWith("acceptance:") ? "acceptance" : focus;
  return BRD_STEPS.find((s) => s.focuses.includes(key))?.id ?? null;
}

/* ── Exit checks ─────────────────────────────────────────────────────────────────────────────── */

export type StepCheck = { id: string; label: string; ok: boolean; required: boolean };

const num = (s: string) => /\d/.test(s);

export function stepChecks(step: BrdStepId, c: BrdContent): StepCheck[] {
  const ck = (id: string, label: string, ok: boolean, required = false): StepCheck => ({
    id,
    label,
    ok,
    required,
  });
  const live = c.requirements.filter((r) => r.priority !== "wont");
  switch (step) {
    case "context":
      return [
        ck("summary", "Executive summary written (2–3 sentences)", c.summary.trim().length >= 40, true),
        ck("background", "Background gives the reader context", c.background.trim().length >= 20),
      ];
    case "problem":
      return [
        ck("problem", "Problem stated in measurable terms", c.problem.trim().length >= 40, true),
        ck("objectives", "At least one business objective", c.objectives.length > 0, true),
        ck(
          "kpis",
          "Every objective has a KPI and a target",
          c.objectives.length > 0 && c.objectives.every((o) => o.kpi && o.target),
          true,
        ),
        ck(
          "targets",
          "Targets are numbers",
          c.objectives.length > 0 && c.objectives.every((o) => num(o.target)),
        ),
        ck("success", "Success criteria for 90 days after launch", c.successCriteria.length > 0),
      ];
    case "scope":
      return [
        ck("in", "In-scope capabilities listed", c.inScope.length > 0, true),
        ck("out", "Out of scope stated", c.outOfScope.length > 0),
        ck(
          "accountable",
          "Someone is Accountable (A)",
          c.stakeholders.some((s) => s.raci === "A"),
          true,
        ),
        ck(
          "consulted",
          "Responsible or consulted people named",
          c.stakeholders.some((s) => s.raci !== "A"),
        ),
      ];
    case "process":
      return [
        ck("current", "Current process described", c.currentState.length > 0),
        ck("pain", "Pain points named", c.painPoints.length > 0),
        ck("future", "Future process described", c.futureState.length > 0),
      ];
    case "requirements": {
      const ids = c.requirements.map((r) => r.id);
      const objectiveIds = new Set(c.objectives.map((o) => o.id));
      const vague = checkBrd(c).some((x) => x.section === "requirements" && /vague/.test(x.message));
      return [
        ck("some", "At least one business requirement", c.requirements.length > 0, true),
        ck(
          "ac",
          "Every requirement has acceptance criteria",
          c.requirements.length > 0 && c.requirements.every((r) => r.acceptance.some((a) => a.trim())),
          true,
        ),
        ck("unique", "Requirement ids are unique", ids.length > 0 && new Set(ids).size === ids.length, true),
        ck(
          "must",
          "At least one Must",
          live.some((r) => r.priority === "must"),
        ),
        ck(
          "traced",
          "Each requirement serves an objective",
          live.length > 0 && live.every((r) => objectiveIds.has(r.objective)),
        ),
        ck("testable", "No vague wording without a number", c.requirements.length > 0 && !vague),
      ];
    }
    case "quality": {
      const restricted = c.data.some((d) => d.classification === "restricted");
      return [
        ck("nfrs", "Non-functional targets captured", c.nfrs.length > 0),
        ck(
          "measurable",
          "NFR targets are measurable",
          c.nfrs.length > 0 && c.nfrs.every((n) => num(n.target)),
        ),
        ck(
          "security",
          "Restricted data has a security requirement",
          !restricted || c.nfrs.some((n) => n.category === "security"),
          true,
        ),
        ck("data", "Data the change touches is listed", c.data.length > 0),
      ];
    }
    case "risks":
      return [
        ck("risks", "Risks identified", c.risks.length > 0),
        ck(
          "mitigated",
          "Every risk has a mitigation",
          c.risks.length > 0 && c.risks.every((r) => r.mitigation.trim()),
        ),
        ck(
          "context",
          "Assumptions, constraints or dependencies recorded",
          c.assumptions.length + c.constraints.length + c.dependencies.length > 0,
        ),
        ck(
          "questions",
          "No open questions",
          c.openQuestions.every((q) => q.status !== "open"),
        ),
      ];
    case "review": {
      const all = checkBrd(c);
      const errors = all.filter((x) => x.severity === "error").length;
      return [
        ck("blocking", "No blocking quality checks", errors === 0, true),
        ck("warnings", "Warnings reviewed (0 open)", all.length === errors),
      ];
    }
  }
}

export type StepProgress = {
  step: BrdStepId;
  checks: StepCheck[];
  passed: number;
  /** done = every check passes; ready = every required check passes; started = some content. */
  status: "done" | "ready" | "started" | "todo";
};

const STEP_KEYS: Record<BrdStepId, (keyof BrdContent)[]> = {
  context: ["summary", "background"],
  problem: ["problem", "objectives", "successCriteria"],
  scope: ["inScope", "outOfScope", "stakeholders"],
  process: ["currentState", "painPoints", "futureState"],
  requirements: ["requirements", "rules"],
  quality: ["nfrs", "data"],
  risks: ["risks", "assumptions", "constraints", "dependencies", "glossary", "openQuestions"],
  review: [],
};

/** Whether anything has been written in the step's sections (checks can pass vacuously). */
function hasContent(step: BrdStepId, c: BrdContent) {
  if (step === "review") return true;
  return STEP_KEYS[step].some((k) => {
    const v = c[k];
    return typeof v === "string" ? v.trim().length > 0 : v.length > 0;
  });
}

export function stepProgress(c: BrdContent): StepProgress[] {
  return BRD_STEPS.map((s) => {
    const checks = stepChecks(s.id, c);
    const passed = checks.filter((x) => x.ok).length;
    const required = checks.filter((x) => x.required);
    const touched = hasContent(s.id, c);
    const status = !touched
      ? "todo"
      : passed === checks.length
        ? "done"
        : required.length > 0 && required.every((x) => x.ok)
          ? "ready"
          : "started";
    return { step: s.id, checks, passed, status };
  });
}

/* ── Structured capture: forms instead of free text ─────────────────────────────────────────── */

const t = (max = 500) => z.string().trim().max(max);
const req = (max = 500) => z.string().trim().min(1).max(max);
const level = z.enum(["high", "medium", "low"]);

export const Capture = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    target: z.enum(["summary", "problem", "background"]),
    text: req(4000),
  }),
  z.object({
    kind: z.literal("objective"),
    statement: req(),
    kpi: req(200),
    baseline: t(100),
    target: req(100),
  }),
  z.object({ kind: z.literal("success"), text: req() }),
  z.object({ kind: z.literal("scope"), inScope: z.boolean(), text: req() }),
  z.object({
    kind: z.literal("stakeholder"),
    name: req(100),
    role: req(100),
    raci: z.enum(["R", "A", "C", "I"]),
    interest: t(300),
  }),
  z.object({ kind: z.literal("process"), when: z.enum(["current", "future"]), actor: req(100), step: req() }),
  z.object({ kind: z.literal("pain"), text: req() }),
  z.object({
    kind: z.literal("requirement"),
    actor: req(100),
    /** What they must be able to do, without "shall be able to". */
    action: req(),
    /** Why: becomes the rationale ("so that …"). */
    benefit: t(),
    priority: MoSCoW,
    area: t(80),
    objective: t(20),
    acceptance: z.array(t()).max(12),
  }),
  z.object({ kind: z.literal("rule"), statement: req() }),
  z.object({
    kind: z.literal("nfr"),
    category: z.enum([
      "availability",
      "performance",
      "security",
      "compliance",
      "usability",
      "reporting",
      "data",
    ]),
    statement: req(),
    target: t(200),
  }),
  z.object({
    kind: z.literal("data"),
    entity: req(100),
    description: t(),
    classification: z.enum(["public", "internal", "confidential", "restricted"]),
    retention: t(100),
  }),
  z.object({
    kind: z.literal("risk"),
    description: req(),
    impact: level,
    likelihood: level,
    mitigation: t(),
    owner: t(100),
  }),
  z.object({
    kind: z.literal("note"),
    list: z.enum(["assumptions", "constraints", "dependencies"]),
    text: req(),
  }),
  z.object({ kind: z.literal("term"), term: req(80), definition: req() }),
  z.object({ kind: z.literal("question"), question: req(), owner: t(100) }),
]);
export type Capture = z.infer<typeof Capture>;

export const SetStep = z.object({ step: BrdStepId });
export type SetStep = z.infer<typeof SetStep>;
