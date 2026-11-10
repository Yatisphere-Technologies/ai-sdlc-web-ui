import { z } from "zod";

export const Stage = z.enum([
  "shape",
  "brd",
  "spec",
  "design",
  "review",
  "build",
  "verify",
  "release",
  "operate",
  "learn",
]);
export type Stage = z.infer<typeof Stage>;

export const STAGES = Stage.options;

export const STAGE_LABEL: Record<Stage, string> = {
  shape: "Shape",
  brd: "BRD",
  spec: "Specify",
  design: "Design",
  review: "Review",
  build: "Build",
  verify: "Verify",
  release: "Release",
  operate: "Operate",
  learn: "Learn",
};

/** Human gates. G0 after Shape, BRD sign-off after the BRD, G1 after Spec, G2 after Review (architecture + security), G3 after Verify, G4 at Release. */
export const Gate = z.enum(["g0", "brd", "g1", "g2", "g3", "g4"]);
export type Gate = z.infer<typeof Gate>;

export const GATE_AFTER_STAGE: Partial<Record<Stage, Gate>> = {
  shape: "g0",
  brd: "brd",
  spec: "g1",
  review: "g2",
  verify: "g3",
  release: "g4",
};

export const GATE_LABEL: Record<Gate, string> = {
  g0: "G0 · Shape",
  brd: "BRD sign-off",
  g1: "G1 · Spec",
  g2: "G2 · Review",
  g3: "G3 · Change",
  g4: "G4 · Release",
};

export const RiskTier = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);
export type RiskTier = z.infer<typeof RiskTier>;

export const WaitingOn = z.object({
  kind: z.enum(["human", "agent"]),
  label: z.string(),
  gate: Gate.nullable(),
});

export const WorkItem = z.object({
  id: z.string(),
  key: z.string(),
  /** Every work item belongs to exactly one project. */
  projectId: z.string(),
  title: z.string(),
  team: z.string(),
  stage: Stage,
  risk: RiskTier,
  waitingOn: WaitingOn,
  ageDays: z.number().nonnegative(),
  aiSpendUsd: z.number().nonnegative(),
});
export type WorkItem = z.infer<typeof WorkItem>;

export const WorkItemList = z.object({ items: z.array(WorkItem), teams: z.array(z.string()) });
export type WorkItemList = z.infer<typeof WorkItemList>;

export const StageItem = z.object({
  key: z.string(),
  title: z.string(),
  progress: z.number().min(0).max(100),
  note: z.string(),
  state: z.enum(["working", "waiting", "done"]),
});

export const StageSummary = z.object({
  stage: Stage,
  count: z.number().int().nonnegative(),
  unit: z.string(),
  activity: z.string(),
  live: z.boolean(),
  blurb: z.string(),
  items: z.array(StageItem),
});
export type StageSummary = z.infer<typeof StageSummary>;

export const AgentRun = z.object({
  id: z.string(),
  code: z.string().max(3),
  name: z.string(),
  model: z.string(),
  task: z.string(),
  progress: z.number().min(0).max(100),
  running: z.boolean(),
});
export type AgentRun = z.infer<typeof AgentRun>;

export const GateDecision = z.object({
  id: z.string(),
  gate: Gate,
  title: z.string(),
  meta: z.string(),
  workItemKey: z.string(),
  status: z.enum(["open", "approved"]),
  approvedBy: z.string().nullable(),
});
export type GateDecision = z.infer<typeof GateDecision>;

export const Kpi = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  delta: z.string(),
  trend: z.enum(["good", "bad"]),
  target: z.string(),
  series: z.array(z.number()),
});
export type Kpi = z.infer<typeof Kpi>;

/** GET /api/t/{tenantId}/control-room */
export const ControlRoom = z.object({
  stages: z.array(StageSummary),
  agents: z.array(AgentRun),
  decisions: z.array(GateDecision),
  kpis: z.array(Kpi),
});
export type ControlRoom = z.infer<typeof ControlRoom>;
