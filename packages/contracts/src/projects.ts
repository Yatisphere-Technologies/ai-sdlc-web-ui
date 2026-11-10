import { z } from "zod";
import { Gate, GateDecision, Stage, WorkItem } from "./delivery";

/* ── Programs and projects ──────────────────────────────────────────────────────────────────────
 * The project is the root everything hangs off: work items, BRDs, architectures, the plan and the
 * backlog all carry a projectId, so nothing is orphaned and everything can be traced. Programs
 * group projects that share an outcome and a sponsor. Shared platforms are their own projects;
 * other projects link to them with "depends-on" instead of copying them in.
 */

export const Health = z.enum(["on-track", "at-risk", "off-track"]);
export type Health = z.infer<typeof Health>;
export const HEALTH_LABEL: Record<Health, string> = {
  "on-track": "On track",
  "at-risk": "At risk",
  "off-track": "Off track",
};

export const ProjectPhase = z.enum([
  "discovery",
  "requirements",
  "design",
  "build",
  "release",
  "operate",
  "closed",
]);
export type ProjectPhase = z.infer<typeof ProjectPhase>;
export const PHASE_LABEL: Record<ProjectPhase, string> = {
  discovery: "Discovery",
  requirements: "Requirements",
  design: "Design",
  build: "Build",
  release: "Release",
  operate: "Operate",
  closed: "Closed",
};

/** ISO date, e.g. 2026-11-30. */
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ProgramOutcome = z.object({ metric: z.string(), baseline: z.string(), target: z.string() });
export type ProgramOutcome = z.infer<typeof ProgramOutcome>;

export const Program = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  objective: z.string(),
  sponsor: z.string(),
  owner: z.string(),
  status: z.enum(["active", "planned", "closed"]),
  health: Health,
  /** Planning horizon, e.g. "FY27 H1". */
  horizon: z.string(),
  budgetUsd: z.number().nonnegative(),
  outcomes: z.array(ProgramOutcome),
});
export type Program = z.infer<typeof Program>;

export const ProjectTools = z.object({
  jira: z.string().nullable(),
  repo: z.string().nullable(),
  cloud: z.string().nullable(),
  confluence: z.string().nullable(),
});
export type ProjectTools = z.infer<typeof ProjectTools>;

export const Project = z.object({
  id: z.string(),
  /** Short key used in URLs and ids, e.g. "SUP". */
  key: z.string().regex(/^[A-Z][A-Z0-9]{1,9}$/),
  programId: z.string(),
  name: z.string(),
  objective: z.string(),
  sponsor: z.string(),
  owner: z.string(),
  teams: z.array(z.string()),
  phase: ProjectPhase,
  health: Health,
  healthNote: z.string(),
  startDate: IsoDate,
  targetDate: IsoDate,
  budgetUsd: z.number().nonnegative(),
  spentUsd: z.number().nonnegative(),
  tools: ProjectTools,
  /** True for a shared platform other projects build on. */
  platform: z.boolean(),
});
export type Project = z.infer<typeof Project>;

/* ── Links between artifacts ──────────────────────────────────────────────────────────────────── */

export const ArtifactType = z.enum([
  "project",
  "work-item",
  "brd",
  "architecture",
  "backlog",
  "plan",
  "test-plan",
  "spec",
  "design",
  "review",
  "build",
  "release",
  "incident",
]);
export type ArtifactType = z.infer<typeof ArtifactType>;
export const ARTIFACT_TYPE_LABEL: Record<ArtifactType, string> = {
  project: "Project",
  "work-item": "Work item",
  brd: "BRD",
  architecture: "Architecture",
  backlog: "Backlog",
  plan: "Plan",
  "test-plan": "Test plan",
  spec: "Spec",
  design: "Design",
  review: "Review pack",
  build: "Build",
  release: "Release",
  incident: "Incident",
};

export const ArtifactRef = z.object({ type: ArtifactType, id: z.string() });
export type ArtifactRef = z.infer<typeof ArtifactRef>;

export const LinkKind = z.enum(["derives-from", "implements", "depends-on", "traces-to", "supersedes"]);
export type LinkKind = z.infer<typeof LinkKind>;
export const LINK_LABEL: Record<LinkKind, string> = {
  "derives-from": "derived from",
  implements: "implements",
  "depends-on": "depends on",
  "traces-to": "traces to",
  supersedes: "supersedes",
};

export const ArtifactLink = z.object({
  id: z.string(),
  from: ArtifactRef,
  to: ArtifactRef,
  kind: LinkKind,
  /** Version of `to` this was built from (e.g. a BRD version); null when not pinned. */
  version: z.string().nullable(),
  note: z.string(),
  /** Stale when `to` has moved on from the pinned version. Computed by the server. */
  state: z.enum(["current", "stale"]),
});
export type ArtifactLink = z.infer<typeof ArtifactLink>;

/* ── Plan ─────────────────────────────────────────────────────────────────────────────────────── */

export const WorkStatus = z.enum(["done", "in-progress", "upcoming", "late", "blocked"]);
export type WorkStatus = z.infer<typeof WorkStatus>;

export const Workstream = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
  start: IsoDate,
  end: IsoDate,
  progress: z.number().min(0).max(100),
  status: WorkStatus,
  refs: z.array(ArtifactRef),
});
export type Workstream = z.infer<typeof Workstream>;

export const Milestone = z.object({
  id: z.string(),
  title: z.string(),
  due: IsoDate,
  status: WorkStatus,
  gate: Gate.nullable(),
  owner: z.string(),
  refs: z.array(ArtifactRef),
  /** Milestone ids this waits for; "KEY:M3" points at another project's milestone. */
  dependsOn: z.array(z.string()),
});
export type Milestone = z.infer<typeof Milestone>;

export const ProjectPlan = z.object({
  id: z.string(),
  projectId: z.string(),
  version: z.string(),
  baselineEnd: IsoDate,
  forecastEnd: IsoDate,
  workstreams: z.array(Workstream),
  milestones: z.array(Milestone),
  updatedAt: z.string(),
});
export type ProjectPlan = z.infer<typeof ProjectPlan>;

/* ── Read models ──────────────────────────────────────────────────────────────────────────────── */

export const ArtifactTone = z.enum(["ok", "gate", "risk", "agent", "neutral"]);

export const ArtifactSummary = z.object({
  ref: ArtifactRef,
  /** Display key, e.g. "BRD-40" or "INT-52". */
  key: z.string(),
  title: z.string(),
  status: z.string(),
  tone: ArtifactTone,
  workItemKey: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type ArtifactSummary = z.infer<typeof ArtifactSummary>;

export const LifecycleStage = z.enum([
  "brd",
  "architecture",
  "plan",
  "backlog",
  "test",
  "build",
  "release",
  "operate",
]);
export type LifecycleStage = z.infer<typeof LifecycleStage>;
export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  brd: "Requirements",
  architecture: "Architecture",
  plan: "Plan",
  backlog: "Backlog",
  test: "Test plan",
  build: "Build",
  release: "Release",
  operate: "Operate",
};

export const LifecycleStep = z.object({
  stage: LifecycleStage,
  state: z.enum(["done", "active", "waiting", "not-started", "stale"]),
  note: z.string(),
  refs: z.array(ArtifactRef),
});
export type LifecycleStep = z.infer<typeof LifecycleStep>;

export const ProjectCounts = z.object({
  workItems: z.number().int().nonnegative(),
  artifacts: z.number().int().nonnegative(),
  openGates: z.number().int().nonnegative(),
  staleLinks: z.number().int().nonnegative(),
});

export const ProjectSummary = Project.extend({
  progress: z.number().min(0).max(100),
  counts: ProjectCounts,
  /** Keys of projects this one depends on. */
  dependsOn: z.array(z.string()),
});
export type ProjectSummary = z.infer<typeof ProjectSummary>;

export const Portfolio = z.object({ programs: z.array(Program), projects: z.array(ProjectSummary) });
export type Portfolio = z.infer<typeof Portfolio>;

export const RelatedProject = z.object({
  key: z.string(),
  name: z.string(),
  direction: z.enum(["depends-on", "used-by"]),
  note: z.string(),
});

export const ProjectOverview = z.object({
  project: ProjectSummary,
  program: Program,
  workItems: z.array(WorkItem),
  artifacts: z.array(ArtifactSummary),
  links: z.array(ArtifactLink),
  lifecycle: z.array(LifecycleStep),
  plan: ProjectPlan.nullable(),
  gates: z.array(GateDecision),
  related: z.array(RelatedProject),
  /** Work-item stages present in the project, for the stage bar. */
  stages: z.array(z.object({ stage: Stage, count: z.number().int().nonnegative() })),
});
export type ProjectOverview = z.infer<typeof ProjectOverview>;

/* ── Writes ───────────────────────────────────────────────────────────────────────────────────── */

export const NewProgram = z.object({
  name: z.string().trim().min(3).max(120),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2–10 capital letters or digits"),
  objective: z.string().trim().min(10).max(1000),
  sponsor: z.string().trim().min(2).max(120),
  horizon: z.string().trim().min(2).max(40),
});
export type NewProgram = z.infer<typeof NewProgram>;

export const NewProject = z.object({
  programId: z.string().min(1),
  name: z.string().trim().min(3).max(120),
  key: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9]{1,9}$/, "2–10 capital letters or digits"),
  objective: z.string().trim().min(10).max(1000),
  sponsor: z.string().trim().min(2).max(120),
  owner: z.string().trim().min(2).max(120),
  teams: z.array(z.string().trim().min(1).max(60)).min(1).max(10),
  startDate: IsoDate,
  targetDate: IsoDate,
  budgetUsd: z.number().nonnegative(),
  platform: z.boolean().default(false),
});
export type NewProject = z.infer<typeof NewProject>;
