import type { Health, Program, ProjectSummary } from "@throughline/contracts";

export type ProgramRollup = {
  program: Program;
  projects: ProjectSummary[];
  health: Record<Health, number>;
  /** Budget-weighted progress across the program's projects, 0–100. */
  progress: number;
  budgetUsd: number;
  spentUsd: number;
  workItems: number;
  artifacts: number;
  openGates: number;
  staleLinks: number;
  /** Latest project target date, or null with no projects. */
  targetDate: string | null;
  platforms: number;
};

/** Everything the programs table shows, summed from the program's projects. */
export function rollup(program: Program, all: readonly ProjectSummary[]): ProgramRollup {
  const projects = all.filter((p) => p.programId === program.id);
  const sum = (f: (p: ProjectSummary) => number) => projects.reduce((n, p) => n + f(p), 0);
  const budget = sum((p) => p.budgetUsd);
  const weight = (p: ProjectSummary) => (budget ? p.budgetUsd : 1);
  const totalWeight = sum(weight);
  return {
    program,
    projects,
    health: {
      "on-track": projects.filter((p) => p.health === "on-track").length,
      "at-risk": projects.filter((p) => p.health === "at-risk").length,
      "off-track": projects.filter((p) => p.health === "off-track").length,
    },
    progress: totalWeight ? Math.round(sum((p) => p.progress * weight(p)) / totalWeight) : 0,
    budgetUsd: budget || program.budgetUsd,
    spentUsd: sum((p) => p.spentUsd),
    workItems: sum((p) => p.counts.workItems),
    artifacts: sum((p) => p.counts.artifacts),
    openGates: sum((p) => p.counts.openGates),
    staleLinks: sum((p) => p.counts.staleLinks),
    targetDate: projects.reduce<string | null>((d, p) => (!d || p.targetDate > d ? p.targetDate : d), null),
    platforms: projects.filter((p) => p.platform).length,
  };
}

/** Projects outside this program that depend on it, keyed by the project they use. */
export function usedBy(all: readonly ProjectSummary[], key: string) {
  return all.filter((p) => p.dependsOn.includes(key)).map((p) => p.key);
}
