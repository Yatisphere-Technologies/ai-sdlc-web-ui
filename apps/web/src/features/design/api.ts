import { DesignList } from "@throughline/contracts";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useDesigns() {
  const { keys } = useTenant();
  return useTenantData(keys.designs, "/designs", DesignList).items;
}

export function useDecideDesign() {
  const { keys } = useTenant();
  return useTenantWrite(keys.designs, DesignList, (v: { designId: string; optionId: string }) => ({
    method: "post",
    path: `/designs/${v.designId}/decide`,
    body: { optionId: v.optionId },
  }));
}
