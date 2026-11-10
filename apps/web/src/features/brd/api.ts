import {
  type BacklogItemPatch,
  BacklogList,
  type BrdContent,
  type BrdDecision,
  BrdList,
  TOOL_LABEL,
} from "@throughline/contracts";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useBrds() {
  const { keys } = useTenant();
  return useTenantData(keys.brds, "/brds", BrdList).items;
}

export function useBacklogs() {
  const { keys } = useTenant();
  return useTenantData(keys.backlogs, "/backlogs", BacklogList, {
    refetchInterval: (d) => (d?.items.some((b) => b.status === "generating") ? 700 : false),
  }).items;
}

export function useSaveBrd() {
  const { keys } = useTenant();
  return useTenantWrite(keys.brds, BrdList, (v: { id: string; content: BrdContent }) => ({
    method: "put",
    path: `/brds/${v.id}/content`,
    body: v.content,
  }));
}

export function useSubmitBrd() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.brds,
    BrdList,
    (v: { id: string }) => ({
      method: "post",
      path: `/brds/${v.id}/submit`,
    }),
    [[...keys.all, "brd-studio"]],
    {
      success: (v, d) => {
        const b = d.items.find((x) => x.id === v.id);
        return {
          title: `Submitted ${v.id} v${b?.version ?? ""} for approval`,
          description: `${b?.approvals.length ?? 0} approvers asked to sign. The document is locked while they review.`,
        };
      },
      error: "Couldn't submit",
    },
  );
}

export function useDecideBrd() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.brds,
    BrdList,
    (v: { id: string } & BrdDecision) => ({
      method: "post",
      path: `/brds/${v.id}/decision`,
      body: { approvalId: v.approvalId, decision: v.decision, comment: v.comment },
    }),
    [[...keys.all, "brd-studio"]],
    {
      success: (v, d) => {
        const b = d.items.find((x) => x.id === v.id);
        if (v.decision === "request-changes")
          return { title: "Changes requested", description: "The author has been asked to revise it." };
        return b?.status === "approved"
          ? {
              title: `${v.id} approved as v${b.version}`,
              description: "Every approver has signed; the backlog can be generated.",
            }
          : "Approval recorded";
      },
      error: "Couldn't record your decision",
    },
  );
}

export function useChangeRequest() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.brds,
    BrdList,
    (v: { id: string; reason: string }) => ({
      method: "post",
      path: `/brds/${v.id}/change-request`,
      body: { reason: v.reason },
    }),
    [[...keys.all, "brd-studio"], keys.backlogs],
    {
      success: (v, d) => {
        const b = d.items.find((x) => x.id === v.id);
        return {
          title: `Change request opened · v${b?.version ?? ""}`,
          description: "The backlog is marked out of date until it's approved again.",
        };
      },
      error: "Couldn't open the change request",
    },
  );
}

export function useGenerateBacklog() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.backlogs,
    BacklogList,
    (v: { id: string }) => ({ method: "post", path: `/backlogs/${v.id}/generate` }),
    [],
    { success: () => "The BA agent is writing the backlog", error: "Couldn't start generating" },
  );
}

export function usePatchItem() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.backlogs,
    BacklogList,
    (v: { backlogId: string; itemId: string; patch: BacklogItemPatch }) => ({
      method: "patch",
      path: `/backlogs/${v.backlogId}/items/${v.itemId}`,
      body: v.patch,
    }),
    [],
    { success: (v) => `${v.itemId} saved`, error: "Couldn't save the item" },
  );
}

export function usePushBacklog() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.backlogs,
    BacklogList,
    (v: { id: string }) => ({ method: "post", path: `/backlogs/${v.id}/push` }),
    [],
    {
      success: (v, d) => {
        const b = d.items.find((x) => x.id === v.id);
        const n = b?.items.filter((i) => i.external).length ?? 0;
        return {
          title: `${n} items in ${b ? TOOL_LABEL[b.target] : "the tool"}`,
          description: b ? `Project ${b.project}, each linked back to ${b.brdId}.` : undefined,
        };
      },
      error: "Couldn't push the backlog",
    },
  );
}
