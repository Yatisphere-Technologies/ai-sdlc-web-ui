import type { TestCasePatch } from "@throughline/contracts";
import { TEST_TOOL_LABEL, TestPlanList, type TestTool } from "@throughline/contracts";
import type { z } from "zod";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useTestPlans() {
  const { keys } = useTenant();
  return useTenantData(keys.testPlans, "/test-plans", TestPlanList).items;
}

export function useCreateTestPlan() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.testPlans,
    TestPlanList,
    (v: { projectId: string }) => ({ method: "post", path: "/test-plans", body: v }),
    [],
    {
      success: () => "Test plan drafted from the project's BRD, backlog and architecture",
      error: "Couldn't draft the plan",
    },
  );
}

export function useRegenerateTestPlan() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.testPlans,
    TestPlanList,
    (v: { id: string }) => ({ method: "post", path: `/test-plans/${v.id}/generate` }),
    [],
    {
      success: (v, data) => {
        const tp = data.items.find((x) => x.id === v.id);
        return {
          title: `Regenerated as v${tp?.version ?? ""}`,
          description: `${tp?.cases.length ?? 0} cases`,
        };
      },
      error: "Couldn't regenerate the plan",
    },
  );
}

export function useTestPlanDecision() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.testPlans,
    TestPlanList,
    (v: { id: string; decision: "submit" | "approve"; approvalId?: string }) => ({
      method: "post",
      path: `/test-plans/${v.id}/decision`,
      body: { decision: v.decision, approvalId: v.approvalId },
    }),
    [],
    {
      success: (v, data) => {
        if (v.decision === "submit") return "Submitted for approval";
        return data.items.find((x) => x.id === v.id)?.status === "approved"
          ? "Test plan approved"
          : "Approval recorded";
      },
      error: "Couldn't record the decision",
    },
  );
}

export function usePatchTestCase() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.testPlans,
    TestPlanList,
    (v: { id: string; caseId: string } & z.infer<typeof TestCasePatch>) => {
      const { id, caseId, ...body } = v;
      return { method: "patch", path: `/test-plans/${id}/cases/${caseId}`, body };
    },
    [],
    { error: "Couldn't update the case" },
  );
}

export function usePushTestPlan() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.testPlans,
    TestPlanList,
    (v: { id: string; target: TestTool }) => ({
      method: "post",
      path: `/test-plans/${v.id}/push`,
      body: { target: v.target },
    }),
    [],
    {
      success: (v, data) => ({
        title: `Pushed to ${TEST_TOOL_LABEL[v.target]}`,
        description: `${data.items.find((x) => x.id === v.id)?.cases.length ?? 0} cases synced`,
      }),
      error: "Couldn't push the plan",
    },
  );
}

export function useRecordRun() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.testPlans,
    TestPlanList,
    (v: { id: string }) => ({ method: "post", path: `/test-plans/${v.id}/runs` }),
    [],
    {
      success: (v, data) => {
        const r = data.items.find((x) => x.id === v.id)?.runs[0];
        return r
          ? {
              title: "CI results received",
              description: `${r.passed} passed · ${r.failed} failed · ${r.blocked} blocked`,
            }
          : "CI results received";
      },
      error: "Couldn't record the run",
    },
  );
}
