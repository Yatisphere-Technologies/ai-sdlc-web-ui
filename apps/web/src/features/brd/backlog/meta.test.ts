import { describe, expect, it } from "vitest";
import { generateBacklog } from "@/mocks/ba/backlog";
import { emailListenerBrdContent, emailListenerHints } from "@/mocks/ba/emailListenerBrd";
import { ancestors, buildIndex, rollup, sprintPlan, traceText, visibleIds } from "./meta";

const items = generateBacklog(emailListenerBrdContent, emailListenerHints, "BRD-40");
const ix = buildIndex(items);

describe("backlog view helpers", () => {
  it("rolls points and hours up the hierarchy", () => {
    const epics = items.filter((i) => i.type === "epic");
    const total = items.filter((i) => i.type === "story").reduce((a, s) => a + (s.points ?? 0), 0);
    expect(epics.reduce((a, e) => a + rollup(ix, e).points, 0)).toBe(total);
    const story = items.find((i) => i.type === "story");
    expect(story && rollup(ix, story).hours).toBeGreaterThan(0);
  });

  it("finds ancestors and reverse dependencies", () => {
    const sub = items.find((i) => i.type === "subtask" && i.parentId === "S20");
    expect(sub && ancestors(ix, sub).map((a) => a.type)).toEqual(["epic", "feature", "story"]);
    expect(ix.blocks.get("S20")).toContain("S21");
  });

  it("plans sprints in order and names trace ids", () => {
    const plan = sprintPlan(items);
    expect(plan[0]?.name).toBe("Sprint 1");
    expect(plan.every((s) => s.points <= 30)).toBe(true);
    expect(traceText(emailListenerBrdContent, "RULE-01")).toMatch(/never answered automatically/);
  });

  it("filters while keeping the path to each match", () => {
    const v = visibleIds(ix, items, { q: "BR-11", release: "all", kind: "all", notReady: false });
    expect(v?.has("S21")).toBe(true);
    expect(v?.has("E4")).toBe(true);
    expect(v?.has("S1")).toBe(false);
    expect(visibleIds(ix, items, { q: "", release: "all", kind: "all", notReady: false })).toBeNull();
  });
});
