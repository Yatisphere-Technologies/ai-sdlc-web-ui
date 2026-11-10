import type { Brd, GateDecision, TestPlan, WorkItem } from "@throughline/contracts";
import { GATE_LABEL } from "@throughline/contracts";

/** Where an approval opens, as a workspace-relative path with search params. */
export type ApprovalLink = { path: string; search?: Record<string, string> };

export type Approval = {
  id: string;
  /** What kind of sign-off it is, e.g. "G2 · Review" or "BRD sign-off". */
  kind: string;
  /** Gate it belongs to, for grouping and colour. Test plans have no lifecycle gate. */
  gate: GateDecision["gate"] | "test";
  title: string;
  meta: string;
  workItemKey: string | null;
  projectId: string | null;
  /** The signed-in user can sign this one. */
  mine: boolean;
  /** Decisions can be approved inline; everything else needs the document opened first. */
  decisionId: string | null;
  to: ApprovalLink;
};

/** Where each gate's evidence lives. */
export function gateLink(gate: GateDecision["gate"], workItemKey: string): ApprovalLink {
  switch (gate) {
    case "g0":
      return { path: "/brd/new" };
    case "brd":
      return { path: "/brd" };
    case "g1":
      return { path: "/brd", search: { view: "specs", wi: workItemKey } };
    case "g2":
      return { path: "/review", search: { wi: workItemKey } };
    case "g3":
      return { path: "/delivery", search: { tab: "verify", wi: workItemKey } };
    case "g4":
      return { path: "/delivery", search: { tab: "release", wi: workItemKey } };
  }
}

export const GATE_ORDER: Approval["gate"][] = ["g0", "brd", "g1", "g2", "test", "g3", "g4"];

/**
 * One queue of every sign-off waiting on a person: lifecycle gate decisions, BRD sign-offs and test
 * plan approvals. A BRD that is also a gate decision is listed once, as the BRD.
 */
export function collectApprovals({
  decisions,
  brds,
  plans,
  workItems,
  canApprove,
  canSignPlans,
}: {
  decisions: GateDecision[];
  brds: Brd[];
  plans: TestPlan[];
  workItems: WorkItem[];
  canApprove: (gate: GateDecision["gate"]) => boolean;
  canSignPlans: boolean;
}): Approval[] {
  const projectOf = (key: string) => workItems.find((w) => w.key === key)?.projectId ?? null;
  const out: Approval[] = [];

  for (const b of brds) {
    if (b.status !== "in-review") continue;
    const pending = b.approvals.filter((a) => a.status === "pending");
    if (!pending.length) continue;
    out.push({
      id: `brd-${b.id}`,
      kind: GATE_LABEL.brd,
      gate: "brd",
      title: `${b.id} · ${b.title}`,
      meta: `v${b.version} · waiting on ${pending.map((a) => a.capacity).join(", ")}`,
      workItemKey: b.workItemKey,
      projectId: b.projectId,
      mine: pending.some((a) => a.isMe),
      decisionId: null,
      to: { path: `/brd/${b.id}` },
    });
  }

  const brdKeys = new Set(out.map((a) => a.workItemKey));
  for (const d of decisions) {
    if (d.status !== "open") continue;
    if (d.gate === "brd" && brdKeys.has(d.workItemKey)) continue;
    out.push({
      id: d.id,
      kind: GATE_LABEL[d.gate],
      gate: d.gate,
      title: d.title,
      meta: d.meta,
      workItemKey: d.workItemKey,
      projectId: projectOf(d.workItemKey),
      mine: canApprove(d.gate),
      decisionId: d.id,
      to: gateLink(d.gate, d.workItemKey),
    });
  }

  for (const p of plans) {
    if (p.status !== "in-review") continue;
    const pending = p.approvals.filter((a) => a.status === "pending");
    if (!pending.length) continue;
    out.push({
      id: `tp-${p.id}`,
      kind: "Test plan",
      gate: "test",
      title: p.title,
      meta: `v${p.version} · waiting on ${pending.map((a) => a.capacity).join(", ")}`,
      workItemKey: null,
      projectId: p.projectId,
      mine: canSignPlans,
      decisionId: null,
      to: { path: "/testing", search: { plan: p.id } },
    });
  }

  return out.sort(
    (a, b) => Number(b.mine) - Number(a.mine) || GATE_ORDER.indexOf(a.gate) - GATE_ORDER.indexOf(b.gate),
  );
}
