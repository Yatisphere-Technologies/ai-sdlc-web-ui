import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AssistantConversation, AssistantConversationList, type AssistantSend } from "@throughline/contracts";
import { useTenant } from "@/tenancy";

/** Non-suspending: the assistant lives in the chrome and must render while data loads. */
export function useConversations() {
  const { api, keys } = useTenant();
  return useQuery({
    queryKey: keys.assistantList,
    queryFn: () => api.get("/assistant/conversations", AssistantConversationList),
    staleTime: 30_000,
  });
}

export function useConversation(id: string | null) {
  const { api, keys } = useTenant();
  return useQuery({
    queryKey: keys.assistantConversation(id ?? "none"),
    queryFn: () => api.get(`/assistant/conversations/${id}`, AssistantConversation),
    enabled: Boolean(id),
  });
}

export function useSendMessage() {
  const { api, keys } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: AssistantSend) => api.post("/assistant/messages", AssistantConversation, v),
    onSuccess: (c) => {
      qc.setQueryData(keys.assistantConversation(c.id), c);
      void qc.invalidateQueries({ queryKey: keys.assistantList });
    },
  });
}

export function useDeleteConversation() {
  const { api, keys } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/assistant/conversations/${id}`, AssistantConversationList),
    onSuccess: (list) => qc.setQueryData(keys.assistantList, list),
  });
}
