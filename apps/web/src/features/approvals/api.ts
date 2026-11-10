import { useQuery } from "@tanstack/react-query";
import {
  type Action,
  BrdList,
  ControlRoom,
  type Gate,
  TestPlanList,
  WorkItemList,
} from "@throughline/contracts";
import { useMemo } from "react";
import { useTenantData } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";
import { type Approval, collectApprovals } from "./model";

/** BRD sign-off is per named approver, not a role permission. */
const gateAction = (g: Gate): Action | null => (g === "brd" ? null : (`gate.approve.${g}` as Action));

/** Every sign-off waiting on a person in this workspace (suspends while loading). */
export function useApprovals(): Approval[] {
  const { keys, can } = useTenant();
  const room = useTenantData(keys.controlRoom, "/control-room", ControlRoom);
  const brds = useTenantData(keys.brds, "/brds", BrdList).items;
  const plans = useTenantData(keys.testPlans, "/test-plans", TestPlanList).items;
  const work = useTenantData(keys.workItems, "/work-items", WorkItemList).items;
  return useMemo(
    () =>
      collectApprovals({
        decisions: room.decisions,
        brds,
        plans,
        workItems: work,
        canApprove: (g) => {
          const a = gateAction(g);
          return a ? can(a) : false;
        },
        canSignPlans: can("work.create"),
      }),
    [room.decisions, brds, plans, work, can],
  );
}

/** How many approvals the signed-in user can act on, for the nav badge. Never suspends. */
export function useMyApprovalCount(): number | null {
  const { api, keys, can } = useTenant();
  const room = useQuery({ queryKey: keys.controlRoom, queryFn: () => api.get("/control-room", ControlRoom) });
  const brds = useQuery({ queryKey: keys.brds, queryFn: () => api.get("/brds", BrdList) });
  const plans = useQuery({ queryKey: keys.testPlans, queryFn: () => api.get("/test-plans", TestPlanList) });
  if (!room.data || !brds.data || !plans.data) return null;
  return collectApprovals({
    decisions: room.data.decisions,
    brds: brds.data.items,
    plans: plans.data.items,
    workItems: [],
    canApprove: (g) => {
      const a = gateAction(g);
      return a ? can(a) : false;
    },
    canSignPlans: can("work.create"),
  }).filter((a) => a.mine).length;
}
