import { useMutation } from "@tanstack/react-query";
import { type ArchBrief, type ArchChoice, ArchitectureList, ChoiceImpact } from "@throughline/contracts";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useArchitectures() {
  const { keys } = useTenant();
  return useTenantData(keys.architectures, "/architectures", ArchitectureList, {
    refetchInterval: (d) => (d?.items.some((a) => a.status === "generating") ? 700 : false),
  }).items;
}

export function useSaveBrief() {
  const { keys } = useTenant();
  return useTenantWrite(keys.architectures, ArchitectureList, (v: { id: string; brief: ArchBrief }) => ({
    method: "put",
    path: `/architectures/${v.id}/brief`,
    body: v.brief,
  }));
}

export function useGenerateArchitecture() {
  const { keys } = useTenant();
  return useTenantWrite(keys.architectures, ArchitectureList, (v: { id: string }) => ({
    method: "post",
    path: `/architectures/${v.id}/generate`,
  }));
}

export function usePreviewChoice(id: string) {
  const { api } = useTenant();
  return useMutation({
    mutationFn: (v: ArchChoice) => api.post(`/architectures/${id}/preview`, ChoiceImpact, v),
  });
}

export function useChooseArchitecture() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.architectures,
    ArchitectureList,
    (v: { id: string } & ArchChoice) => ({
      method: "post",
      path: `/architectures/${v.id}/choose`,
      body: { field: v.field, value: v.value },
    }),
    [],
    {
      success: (v, data) => {
        const a = data.items.find((x) => x.id === v.id);
        return {
          title: `Revision ${a?.revision ?? ""} generated`,
          description: `${v.field} changed; diagrams, decisions and document updated.`,
        };
      },
      error: "Couldn't apply the change",
    },
  );
}
