import type { Program, ProjectSummary } from "@throughline/contracts";
import { acmeProjects } from "@/mocks/seed/projects";
import { rollup, usedBy } from "./rollup";

const program = acmeProjects.programs[0] as Program;
const summary = (p: (typeof acmeProjects.projects)[number], progress: number): ProjectSummary => ({
  ...p,
  progress,
  counts: { workItems: 2, artifacts: 3, openGates: 1, staleLinks: 0 },
  dependsOn: p.key === "SUP" ? ["MCP"] : [],
});

describe("program rollup", () => {
  const all = acmeProjects.projects.map((p, i) => summary(p, i * 10));
  const r = rollup(program, all);

  it("only counts the program's own projects", () => {
    expect(r.projects.every((p) => p.programId === program.id)).toBe(true);
    expect(r.workItems).toBe(r.projects.length * 2);
    expect(r.health["on-track"] + r.health["at-risk"] + r.health["off-track"]).toBe(r.projects.length);
  });

  it("weights progress by budget and takes the latest target date", () => {
    const budget = r.projects.reduce((n, p) => n + p.budgetUsd, 0);
    const expected = Math.round(r.projects.reduce((n, p) => n + p.progress * p.budgetUsd, 0) / budget);
    expect(r.progress).toBe(expected);
    expect(r.targetDate).toBe([...r.projects.map((p) => p.targetDate)].sort().at(-1));
  });

  it("handles a program with no projects", () => {
    const empty = rollup({ ...program, id: "pg-none" }, all);
    expect(empty).toMatchObject({ progress: 0, targetDate: null, budgetUsd: program.budgetUsd });
  });

  it("finds who uses a shared platform", () => {
    expect(usedBy(all, "MCP")).toEqual(["SUP"]);
  });
});
