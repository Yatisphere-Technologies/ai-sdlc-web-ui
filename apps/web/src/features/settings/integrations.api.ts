import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Integration, IntegrationList } from "@throughline/contracts";
import type { z } from "zod";
import { useTenant } from "@/tenancy";

type List = z.infer<typeof IntegrationList>;

export function useIntegrations() {
  const { api, keys } = useTenant();
  return useSuspenseQuery(
    queryOptions({ queryKey: keys.integrations, queryFn: () => api.get("/integrations", IntegrationList) }),
  ).data.items;
}

function useReplaceIntegration() {
  const { keys } = useTenant();
  const queryClient = useQueryClient();
  return (updated: Integration) =>
    queryClient.setQueryData<List>(keys.integrations, (prev) =>
      prev ? { items: prev.items.map((i) => (i.id === updated.id ? updated : i)) } : prev,
    );
}

export function useToggleWriteBack(integrationId: string) {
  const { api } = useTenant();
  const replace = useReplaceIntegration();
  return useMutation({
    mutationFn: ({ optionId, enabled }: { optionId: string; enabled: boolean }) =>
      api.patch(`/integrations/${integrationId}/write-back/${optionId}`, Integration, { enabled }),
    onSuccess: replace,
  });
}

export function useConnectIntegration(integrationId: string) {
  const { api } = useTenant();
  const replace = useReplaceIntegration();
  return useMutation({
    mutationFn: (auth: string) => api.post(`/integrations/${integrationId}/connect`, Integration, { auth }),
    onSuccess: replace,
  });
}
