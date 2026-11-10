import { z } from "zod";
import { Gate, RiskTier, Stage } from "./delivery";

/* ── Specs (G1) ─────────────────────────────────────────────────────────── */

export const Requirement = z.object({
  id: z.string(),
  title: z.string(),
  /** EARS pattern keywords, e.g. WHEN / WHILE / IF / THEN */
  keyword1: z.string(),
  clause1: z.string(),
  keyword2: z.string(),
  clause2: z.string(),
  response: z.string(),
  checks: z.number().int().nonnegative(),
  status: z.enum(["agreed", "open-question", "agent-checking"]),
  question: z.string().nullable(),
});
export type Requirement = z.infer<typeof Requirement>;

export const ChecklistItem = z.object({ id: z.string(), label: z.string(), done: z.boolean() });

export const PlannedTask = z.object({
  id: z.string(),
  title: z.string(),
  assignee: z.string(),
  kind: z.enum(["agent", "human"]),
  requirements: z.array(z.string()),
});

export const Spec = z.object({
  id: z.string(),
  workItemKey: z.string(),
  title: z.string(),
  owner: z.string(),
  author: z.string(),
  risk: RiskTier,
  status: z.enum(["drafting", "in-review", "approved"]),
  approvedBy: z.string().nullable(),
  requirements: z.array(Requirement),
  checklist: z.array(ChecklistItem),
  tasks: z.array(PlannedTask),
});
export type Spec = z.infer<typeof Spec>;
export const SpecList = z.object({ items: z.array(Spec) });

/* ── Design ─────────────────────────────────────────────────────────────── */

export const DesignOption = z.object({
  id: z.string(),
  letter: z.string(),
  name: z.string(),
  summary: z.string(),
  recommended: z.boolean(),
  metrics: z.array(z.object({ label: z.string(), value: z.string(), score: z.number(), good: z.boolean() })),
  components: z.array(z.object({ name: z.string(), change: z.enum(["existing", "changed", "new"]) })),
  rationale: z.string(),
});
export type DesignOption = z.infer<typeof DesignOption>;

export const Design = z.object({
  id: z.string(),
  workItemKey: z.string(),
  title: z.string(),
  status: z.enum(["comparing", "decided"]),
  chosenOptionId: z.string().nullable(),
  decidedBy: z.string().nullable(),
  options: z.array(DesignOption),
});
export type Design = z.infer<typeof Design>;
export const DesignList = z.object({ items: z.array(Design) });

/* ── Review: architecture + security artifact pack (G2) ─────────────────── */

export const ArtifactKind = z.enum([
  "architecture",
  "adr",
  "threat-model",
  "security-review",
  "nfr",
  "data-protection",
  "compliance-map",
]);
export type ArtifactKind = z.infer<typeof ArtifactKind>;

export const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  architecture: "Architecture overview",
  adr: "Decision records",
  "threat-model": "Threat model · STRIDE",
  "security-review": "Security review · OWASP ASVS",
  nfr: "Non-functional requirements",
  "data-protection": "Data protection impact",
  "compliance-map": "Compliance control map",
};

export const ArtifactSection = z.object({
  heading: z.string(),
  body: z.string().optional(),
  table: z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) }).optional(),
  checks: z
    .array(
      z.object({ label: z.string(), state: z.enum(["pass", "fail", "partial", "na"]), note: z.string() }),
    )
    .optional(),
  /** Simple left-to-right component flow for diagrams */
  flow: z
    .array(z.object({ name: z.string(), zone: z.enum(["user", "edge", "app", "data", "external"]) }))
    .optional(),
});
export type ArtifactSection = z.infer<typeof ArtifactSection>;

export const Artifact = z.object({
  id: z.string(),
  kind: ArtifactKind,
  status: z.enum(["queued", "generating", "draft", "approved"]),
  generatedBy: z.string(),
  summary: z.string(),
  sections: z.array(ArtifactSection),
});
export type Artifact = z.infer<typeof Artifact>;

export const Severity = z.enum(["critical", "high", "medium", "low"]);
export type Severity = z.infer<typeof Severity>;

export const Finding = z.object({
  id: z.string(),
  artifactId: z.string(),
  severity: Severity,
  title: z.string(),
  detail: z.string(),
  status: z.enum(["open", "resolved", "accepted"]),
  resolvedBy: z.string().nullable(),
});
export type Finding = z.infer<typeof Finding>;

export const SignoffRole = z.enum(["architecture", "security"]);
export type SignoffRole = z.infer<typeof SignoffRole>;

export const ReviewPack = z.object({
  id: z.string(),
  workItemKey: z.string(),
  title: z.string(),
  risk: RiskTier,
  status: z.enum(["not-started", "generating", "in-review", "signed-off"]),
  progress: z.number().min(0).max(100),
  artifacts: z.array(Artifact),
  findings: z.array(Finding),
  signoffs: z.array(z.object({ role: SignoffRole, by: z.string().nullable() })),
});
export type ReviewPack = z.infer<typeof ReviewPack>;
export const ReviewList = z.object({ items: z.array(ReviewPack) });

export const UpdateFinding = z.object({ status: z.enum(["resolved", "accepted"]) });
export const SignoffRequest = z.object({ role: SignoffRole });

/** Blocking findings must be resolved or accepted before anyone can sign. */
export function blockingFindings(pack: Pick<ReviewPack, "findings">) {
  return pack.findings.filter(
    (f) => f.status === "open" && (f.severity === "critical" || f.severity === "high"),
  );
}

/* ── Build ──────────────────────────────────────────────────────────────── */

export const AgentLane = z.object({
  id: z.string(),
  agent: z.string(),
  model: z.string(),
  task: z.string(),
  workItemKey: z.string(),
  /** 0 plan · 1 code · 2 test · 3 self-review · 4 PR */
  step: z.number().int().min(0).max(4),
  branch: z.string(),
  context: z.string(),
  cacheHit: z.string(),
  costUsd: z.number(),
  requirements: z.array(z.string()),
  log: z.array(
    z.object({ t: z.string(), text: z.string(), level: z.enum(["muted", "info", "warn", "error", "ok"]) }),
  ),
  diff: z.object({
    file: z.string(),
    added: z.number(),
    removed: z.number(),
    lines: z.array(z.object({ sign: z.enum(["+", "-", " "]), code: z.string(), req: z.string().nullable() })),
  }),
});
export type AgentLane = z.infer<typeof AgentLane>;
export const BuildBoard = z.object({ lanes: z.array(AgentLane) });

/* ── Verify (G3) ────────────────────────────────────────────────────────── */

export const EvidenceCell = z.enum(["pass", "fixed", "running", "na"]);

export const VerifyChange = z.object({
  id: z.string(),
  prKey: z.string(),
  title: z.string(),
  workItemKey: z.string(),
  confidence: z.number().min(0).max(100),
  blastRadius: z.string(),
  mutationScore: z.string(),
  rollback: z.string(),
  columns: z.array(z.string()),
  rows: z.array(z.object({ req: z.string(), title: z.string(), cells: z.array(EvidenceCell) })),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: Severity,
      title: z.string(),
      source: z.string(),
      state: z.string(),
    }),
  ),
  keys: z.array(z.object({ role: z.enum(["agent", "human"]), name: z.string(), signed: z.boolean() })),
  status: z.enum(["awaiting", "merged"]),
});
export type VerifyChange = z.infer<typeof VerifyChange>;
export const VerifyList = z.object({ items: z.array(VerifyChange) });

/* ── Release (G4) ───────────────────────────────────────────────────────── */

export const Release = z.object({
  id: z.string(),
  /** Work item (and so the project) the release ships. */
  workItemKey: z.string(),
  name: z.string(),
  service: z.string(),
  steps: z.array(z.object({ percent: z.number(), audience: z.string() })),
  currentStep: z.number().int().nonnegative(),
  status: z.enum(["rolling", "complete", "rolled-back"]),
  provenance: z.array(z.string()),
  health: z.array(
    z.object({
      metric: z.string(),
      canary: z.string(),
      baseline: z.string(),
      redLine: z.string(),
      series: z.array(z.number()),
      baseSeries: z.array(z.number()),
    }),
  ),
});
export type Release = z.infer<typeof Release>;
export const ReleaseList = z.object({ items: z.array(Release) });

/* ── Operate → Learn ────────────────────────────────────────────────────── */

export const Incident = z.object({
  id: z.string(),
  /** Work item (and so the project) whose change or service the incident is about. */
  workItemKey: z.string(),
  title: z.string(),
  severity: z.enum(["sev1", "sev2", "sev3"]),
  status: z.enum(["open", "resolved"]),
  service: z.string(),
  startedAt: z.string(),
  detectedIn: z.string(),
  onCall: z.string(),
  timeline: z.array(
    z.object({
      time: z.string(),
      text: z.string(),
      kind: z.enum(["change", "alert", "agent", "human", "ok"]),
    }),
  ),
  hypotheses: z.array(z.object({ title: z.string(), confidence: z.number(), evidence: z.string() })),
  action: z.string(),
  learning: z.object({ rule: z.string(), detail: z.string(), changes: z.array(z.string()) }),
});
export type Incident = z.infer<typeof Incident>;
export const IncidentList = z.object({ items: z.array(Incident) });

/* ── Trace ──────────────────────────────────────────────────────────────── */

export const TraceStep = z.object({
  stage: Stage,
  gate: Gate.nullable(),
  artifact: z.string(),
  title: z.string(),
  actor: z.string(),
  actorKind: z.enum(["agent", "human"]),
  when: z.string(),
  tool: z.string(),
  evidence: z.array(z.object({ k: z.string(), v: z.string() })),
  evidenceHash: z.string(),
});
export type TraceStep = z.infer<typeof TraceStep>;

export const Trace = z.object({
  workItemKey: z.string(),
  title: z.string(),
  totalDays: z.number(),
  segments: z.array(
    z.object({ label: z.string(), days: z.number(), kind: z.enum(["agent", "human", "wait"]) }),
  ),
  steps: z.array(TraceStep),
});
export type Trace = z.infer<typeof Trace>;

/* ── Insights ───────────────────────────────────────────────────────────── */

export const InsightsPeriod = z.enum(["30d", "90d", "6m"]);
export type InsightsPeriod = z.infer<typeof InsightsPeriod>;

export const Insights = z.object({
  period: InsightsPeriod,
  dora: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
      delta: z.string(),
      before: z.number(),
      now: z.number(),
    }),
  ),
  throughput: z.array(z.object({ week: z.string(), agent: z.number(), human: z.number() })),
  spend: z.object({
    used: z.number(),
    budget: z.number(),
    byAgent: z.array(z.object({ label: z.string(), pct: z.number() })),
    costPerChange: z.number(),
  }),
  governance: z.array(
    z.object({ label: z.string(), value: z.string(), tone: z.enum(["ok", "gate", "agent", "risk"]) }),
  ),
});
export type Insights = z.infer<typeof Insights>;

/* ── Ask ────────────────────────────────────────────────────────────────── */

export const AskRequest = z.object({ question: z.string().min(2).max(500) });

export const AskAnswer = z.object({
  question: z.string(),
  headline: z.string(),
  stage: Stage.nullable(),
  rows: z.array(
    z.object({
      tone: z.enum(["ok", "gate", "ion", "risk"]),
      text: z.string(),
      sub: z.string(),
      source: z.string(),
    }),
  ),
  actions: z.array(z.string()),
  asOf: z.string(),
});
export type AskAnswer = z.infer<typeof AskAnswer>;
