import type { ProjectPlan } from "@throughline/contracts";
import { dependencies, slipDays, timeline } from "./plan";

const plan: ProjectPlan = {
  id: "plan-x",
  projectId: "prj-x",
  version: "1.0",
  baselineEnd: "2027-03-12",
  forecastEnd: "2027-03-26",
  workstreams: [
    {
      id: "a",
      name: "A",
      owner: "o",
      start: "2026-10-01",
      end: "2026-12-15",
      progress: 50,
      status: "in-progress",
      refs: [],
    },
  ],
  milestones: [
    {
      id: "M5",
      title: "Go-live",
      due: "2027-02-15",
      status: "upcoming",
      gate: "g4",
      owner: "o",
      refs: [],
      dependsOn: ["M4", "MCP:M4"],
    },
  ],
  updatedAt: "2026-10-24T00:00:00Z",
};

describe("project plan timeline", () => {
  it("spans whole months from the first start to the last date", () => {
    const tl = timeline(plan, "2026-10-26");
    expect(tl.months[0]?.label).toBe("Oct");
    expect(tl.months.at(-1)?.label).toBe("Mar");
    expect(tl.at("2026-10-01")).toBe(0);
    expect(tl.at("2027-03-26")).toBeGreaterThan(90);
  });

  it("measures slip against the baseline", () => {
    expect(slipDays(plan)).toBe(14);
    expect(slipDays({ ...plan, forecastEnd: "2027-03-01" })).toBe(0);
  });

  it("separates dependencies on other projects", () => {
    const m = plan.milestones[0];
    if (!m) throw new Error("seed");
    expect(dependencies(m)).toEqual({ local: ["M4"], external: [{ project: "MCP", milestone: "M4" }] });
  });
});
