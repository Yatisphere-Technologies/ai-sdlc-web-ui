import { describe, expect, it } from "vitest";
import type { BrdContent } from "./brd";
import { BRD_STEPS, Capture, stepForFocus, stepProgress } from "./brdSteps";

const blank: BrdContent = {
  summary: "",
  problem: "",
  background: "",
  objectives: [],
  inScope: [],
  outOfScope: [],
  stakeholders: [],
  currentState: [],
  painPoints: [],
  futureState: [],
  requirements: [],
  rules: [],
  nfrs: [],
  data: [],
  assumptions: [],
  constraints: [],
  dependencies: [],
  risks: [],
  successCriteria: [],
  glossary: [],
  openQuestions: [],
};

describe("guided BRD steps", () => {
  it("treats untouched steps as not started even when some checks pass vacuously", () => {
    const p = stepProgress(blank);
    expect(p.filter((x) => x.step !== "review").every((x) => x.status === "todo")).toBe(true);
  });

  it("marks a step ready when its required checks pass and done when all do", () => {
    const c = {
      ...blank,
      inScope: ["Daily report"],
      stakeholders: [{ name: "A", role: "Sponsor", raci: "A" as const, interest: "" }],
    };
    expect(stepProgress(c).find((x) => x.step === "scope")?.status).toBe("ready");
    const all = {
      ...c,
      outOfScope: ["Refunds"],
      stakeholders: [...c.stakeholders, { name: "B", role: "Ops", raci: "C" as const, interest: "" }],
    };
    expect(stepProgress(all).find((x) => x.step === "scope")?.status).toBe("done");
  });

  it("maps every agent focus to the step that owns it", () => {
    expect(stepForFocus("acceptance:BR-03")).toBe("requirements");
    expect(stepForFocus("outOfScope")).toBe("scope");
    for (const s of BRD_STEPS) for (const f of s.focuses) expect(stepForFocus(f)).toBe(s.id);
  });

  it("validates structured entries", () => {
    expect(Capture.safeParse({ kind: "pain", text: "  " }).success).toBe(false);
    expect(
      Capture.safeParse({ kind: "stakeholder", name: "A", role: "B", raci: "X", interest: "" }).success,
    ).toBe(false);
    expect(
      Capture.safeParse({
        kind: "risk",
        description: "Late file",
        impact: "high",
        likelihood: "low",
        mitigation: "",
        owner: "",
      }).success,
    ).toBe(true);
  });
});
