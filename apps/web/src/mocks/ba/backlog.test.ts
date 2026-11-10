import { brdScore, checkBrd, mustCoverage, storyChecks } from "@throughline/contracts";
import { describe, expect, it } from "vitest";
import { acmeBrdContent, acmeHints } from "./acmeBrd";
import { generateBacklog } from "./backlog";
import { emailListenerBrdContent, emailListenerHints } from "./emailListenerBrd";
import { fabrikamBrdContent, northwindBrdContent, northwindHints } from "./otherBrds";

describe("BRD quality checks", () => {
  it("passes the approved-quality Acme BRD with no blocking errors", () => {
    const checks = checkBrd(acmeBrdContent);
    expect(checks.filter((c) => c.severity === "error")).toEqual([]);
    expect(brdScore(checks)).toBeGreaterThan(80);
  });

  it("catches what a reviewing BA would in the Fabrikam draft", () => {
    const messages = checkBrd(fabrikamBrdContent).map((c) => `${c.severity}:${c.target}:${c.message}`);
    expect(messages.some((m) => m.startsWith("error:BR-03") && m.includes("no acceptance criteria"))).toBe(
      true,
    );
    expect(messages.some((m) => m.includes("vague wording"))).toBe(true);
    expect(messages.some((m) => m.includes("Accountable"))).toBe(true);
    expect(messages.some((m) => m.includes('"low" has no number'))).toBe(true);
    expect(messages.some((m) => m.includes("out of scope"))).toBe(true);
  });
});

describe("backlog generation", () => {
  const items = generateBacklog(acmeBrdContent, acmeHints, "BRD-31");
  const byId = new Map(items.map((i) => [i.id, i]));

  it("builds epic → feature → story → sub-task with valid parents", () => {
    for (const i of items) {
      const parent = i.parentId ? byId.get(i.parentId) : undefined;
      if (i.type === "epic") expect(i.parentId).toBeNull();
      if (i.type === "feature") expect(parent?.type).toBe("epic");
      if (i.type === "subtask") expect(parent?.type).toBe("story");
      if (i.type === "story") expect(["feature", "epic"]).toContain(parent?.type);
    }
  });

  it("covers every Must requirement and leaves Won't out", () => {
    expect(mustCoverage(acmeBrdContent, items).missing).toEqual([]);
    expect(
      mustCoverage(northwindBrdContent, generateBacklog(northwindBrdContent, northwindHints, "BRD-199"))
        .missing,
    ).toEqual([]);
    expect(items.some((i) => i.traces.includes("BR-10"))).toBe(false);
  });

  it("writes stories that meet the definition of ready, and traces business rules", () => {
    const stories = items.filter((i) => i.type === "story");
    expect(stories.flatMap(storyChecks)).toEqual([]);
    expect(stories.some((s) => s.traces.includes("RULE-02"))).toBe(true);
  });

  it("flags stories it had to write without refinement notes", () => {
    const fallback = generateBacklog(fabrikamBrdContent, {}, "BRD-12").filter(
      (i) => i.type === "story" && i.labels.includes("needs-refinement"),
    );
    expect(fallback.length).toBeGreaterThan(0);
    expect(fallback.every((s) => storyChecks(s).some((c) => c.id === "est"))).toBe(true);
  });

  it("plans sprints within capacity", () => {
    const load = new Map<string, number>();
    for (const s of items.filter((i) => i.type === "story"))
      load.set(s.iteration ?? "", (load.get(s.iteration ?? "") ?? 0) + (s.points ?? 0));
    for (const v of load.values()) expect(v).toBeLessThanOrEqual(30);
  });

  it("is deterministic", () => {
    expect(generateBacklog(acmeBrdContent, acmeHints, "BRD-31")).toEqual(items);
  });
});

describe("BRD-40 agentic email listener", () => {
  const items = generateBacklog(emailListenerBrdContent, emailListenerHints, "BRD-40");
  const stories = items.filter((i) => i.type === "story");
  const byId = new Map(items.map((i) => [i.id, i]));
  const sprint = (i: { iteration: string | null }) => Number(i.iteration?.replace("Sprint ", "") ?? 0);

  it("is approval-ready", () => {
    expect(checkBrd(emailListenerBrdContent).filter((c) => c.severity === "error")).toEqual([]);
  });

  it("produces an enterprise-ready backlog", () => {
    expect(mustCoverage(emailListenerBrdContent, items).missing).toEqual([]);
    expect(stories.flatMap(storyChecks)).toEqual([]);
    for (const s of stories) {
      expect(s.tests.length).toBeGreaterThan(0);
      expect(s.release).toBeTruthy();
      expect(s.owner).toBeTruthy();
    }
    expect(items.filter((i) => i.type === "subtask").every((t) => t.taskKind && t.hours)).toBe(true);
    expect(items.some((i) => i.kind === "transition")).toBe(true);
    expect(stories.filter((s) => s.kind === "spike").map((s) => s.traces[0])).toEqual(["OQ-2", "OQ-3"]);
    expect(items.some((i) => i.traces.includes("BR-16"))).toBe(false);
  });

  it("plans dependencies before the stories that need them, within capacity", () => {
    for (const s of stories)
      for (const d of s.dependsOn)
        expect(sprint(byId.get(d) ?? { iteration: null })).toBeLessThanOrEqual(sprint(s));
    const load = new Map<string, number>();
    for (const s of stories)
      load.set(s.iteration ?? "", (load.get(s.iteration ?? "") ?? 0) + (s.points ?? 0));
    for (const v of load.values()) expect(v).toBeLessThanOrEqual(30);
  });
});
