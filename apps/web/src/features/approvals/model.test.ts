import type { Brd, GateDecision, TestPlan } from "@throughline/contracts";
import { describe, expect, it } from "vitest";
import { collectApprovals, gateLink } from "./model";

const decision = (
  id: string,
  gate: GateDecision["gate"],
  wi: string,
  status: GateDecision["status"] = "open",
) => ({ id, gate, title: id, meta: "", workItemKey: wi, status, approvedBy: null }) as GateDecision;

const brd = (id: string, wi: string, isMe: boolean) =>
  ({
    id,
    projectId: "prj-a",
    workItemKey: wi,
    title: id,
    version: "1.0",
    status: "in-review",
    approvals: [
      { id: "a", capacity: "Sponsor", name: "Me", isMe, status: "pending", at: null, comment: null },
    ],
  }) as unknown as Brd;

const plan = (id: string) =>
  ({
    id,
    projectId: "prj-b",
    title: id,
    version: "1.0",
    status: "in-review",
    approvals: [{ id: "x", capacity: "QA lead", name: "Q", status: "pending", at: null }],
  }) as unknown as TestPlan;

describe("collectApprovals", () => {
  it("merges gates, BRDs and test plans; mine first; skips closed and duplicate BRD gates", () => {
    const out = collectApprovals({
      decisions: [
        decision("g3", "g3", "INT-1"),
        decision("closed", "g2", "INT-2", "approved"),
        decision("dup", "brd", "INT-9"),
        decision("g2", "g2", "INT-3"),
      ],
      brds: [brd("BRD-1", "INT-9", true)],
      plans: [plan("tp-1")],
      workItems: [{ key: "INT-3", projectId: "prj-c" } as never],
      canApprove: (g) => g === "g2",
      canSignPlans: false,
    });
    expect(out.map((a) => a.id)).toEqual(["brd-BRD-1", "g2", "tp-tp-1", "g3"]);
    expect(out.find((a) => a.id === "g2")?.projectId).toBe("prj-c");
    expect(out.find((a) => a.id === "g3")?.mine).toBe(false);
  });

  it("deep-links each gate to where its evidence lives", () => {
    expect(gateLink("g1", "INT-1")).toEqual({ path: "/brd", search: { view: "specs", wi: "INT-1" } });
    expect(gateLink("g3", "INT-1").search?.tab).toBe("verify");
    expect(gateLink("g4", "INT-1").path).toBe("/delivery");
  });
});
