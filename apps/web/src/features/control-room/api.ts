import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ControlRoom, GateDecision } from "@throughline/contracts";
import { useTenant } from "@/tenancy";

export function useControlRoom() {
  const { api, keys } = useTenant();
  return useSuspenseQuery(
    queryOptions({ queryKey: keys.controlRoom, queryFn: () => api.get("/control-room", ControlRoom) }),
  ).data;
}

export function useApproveGate() {
  const { api, keys } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (decisionId: string) => api.post(`/gates/${decisionId}/approve`, GateDecision),
    onSuccess: (updated) => {
      queryClient.setQueryData<ControlRoom>(keys.controlRoom, (prev) =>
        prev ? { ...prev, decisions: prev.decisions.map((d) => (d.id === updated.id ? updated : d)) } : prev,
      );
    },
  });
}
