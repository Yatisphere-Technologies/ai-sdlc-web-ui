import { SpecList } from "@throughline/contracts";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useSpecs() {
  const { keys } = useTenant();
  return useTenantData(keys.specs, "/specs", SpecList).items;
}

export function useToggleCheck() {
  const { keys } = useTenant();
  return useTenantWrite(keys.specs, SpecList, (v: { specId: string; itemId: string; done: boolean }) => ({
    method: "patch",
    path: `/specs/${v.specId}/checklist/${v.itemId}`,
    body: { enabled: v.done },
  }));
}

export function useApproveSpec() {
  const { keys } = useTenant();
  return useTenantWrite(keys.specs, SpecList, (specId: string) => ({
    method: "post",
    path: `/specs/${specId}/approve`,
  }));
}
