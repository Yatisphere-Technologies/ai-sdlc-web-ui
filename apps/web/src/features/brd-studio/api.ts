import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import {
  type AddSource,
  type Anchor,
  type BrdDocUpdate,
  type BrdStepId,
  type Capture,
  type NewBrd,
  StudioState,
  type StudioState as StudioStateT,
  WorkspaceDocList,
} from "@throughline/contracts";
import { type Notify, notifyError, notifySuccess, useTenantData } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useStudio(brdId: string) {
  const { keys } = useTenant();
  return useTenantData(keys.brdStudio(brdId), `/brds/${brdId}/studio`, StudioState);
}

export function useWorkspaceDocs(brdId: string) {
  const { api, keys } = useTenant();
  return useSuspenseQuery({
    queryKey: keys.workspaceDocs(brdId),
    queryFn: () => api.get(`/brds/${brdId}/workspace-docs`, WorkspaceDocList),
  }).data.items;
}

/** Key for studio writes, so the screen can show what the agent is busy with. */
export const studioMutation = (brdId: string, kind: string) => ["brd-studio", brdId, kind] as const;

type StudioCall = { method: "post" | "put" | "delete"; path: `/${string}`; body?: unknown };

/** Every studio write returns the full studio state, so the cache always matches the server. */
function useStudioWrite<V>(
  brdId: string,
  call: (v: V) => StudioCall,
  kind = "write",
  notify?: Notify<V, StudioStateT>,
) {
  const { api, keys } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationKey: studioMutation(brdId, kind),
    mutationFn: (v: V) => {
      const c = call(v);
      if (c.method === "put") return api.put(c.path, StudioState, c.body ?? {});
      if (c.method === "delete") return api.delete(c.path, StudioState);
      return api.post(c.path, StudioState, c.body);
    },
    onSuccess: (data, vars) => {
      qc.setQueryData(keys.brdStudio(brdId), data);
      void qc.invalidateQueries({ queryKey: keys.brds });
      void qc.invalidateQueries({ queryKey: keys.projects });
      notifySuccess(notify, vars, data);
    },
    onError: (err) => notifyError(notify, err),
  });
}

export const useSaveDocument = (brdId: string) =>
  useStudioWrite(
    brdId,
    (doc: BrdDocUpdate) => ({ method: "put", path: `/brds/${brdId}/document`, body: doc }),
    "write",
    { error: "Couldn't save the document" },
  );

export type OutgoingMessage = { text: string; attachments?: string[]; context?: Anchor | null };

export const useSendMessage = (brdId: string) =>
  useStudioWrite(
    brdId,
    (m: string | OutgoingMessage) => ({
      method: "post",
      path: `/brds/${brdId}/messages`,
      body: typeof m === "string" ? { text: m } : { attachments: [], context: null, ...m },
    }),
    "message",
  );

export const useAddComment = (brdId: string) =>
  useStudioWrite(
    brdId,
    (c: { anchor: Anchor; text: string; askAgent: boolean }) => ({
      method: "post",
      path: `/brds/${brdId}/comments`,
      body: c,
    }),
    "comment",
    {
      success: (c) => (c.askAgent ? "Comment added; the BA agent is replying" : "Comment added"),
      error: "Couldn't add the comment",
    },
  );

export const useReplyComment = (brdId: string) =>
  useStudioWrite(
    brdId,
    (r: { threadId: string; text: string; askAgent: boolean }) => ({
      method: "post",
      path: `/brds/${brdId}/comments/${r.threadId}/replies`,
      body: { text: r.text, askAgent: r.askAgent },
    }),
    "reply",
  );

export const useResolveComment = (brdId: string) =>
  useStudioWrite(
    brdId,
    (r: { threadId: string; resolved: boolean }) => ({
      method: "post",
      path: `/brds/${brdId}/comments/${r.threadId}/resolve`,
      body: { resolved: r.resolved },
    }),
    "write",
    {
      success: (r) => (r.resolved ? "Thread resolved" : "Thread reopened"),
      error: "Couldn't update the thread",
    },
  );

const DECIDED = { accept: "Change accepted", reject: "Suggestion rejected", undo: "Edit undone" } as const;

export const useDecideProposal = (brdId: string) =>
  useStudioWrite(
    brdId,
    (v: { id: string; decision: "accept" | "reject" | "undo"; quiet?: boolean }) => ({
      method: "post",
      path: `/brds/${brdId}/proposals/${v.id}`,
      body: { decision: v.decision },
    }),
    "write",
    {
      success: (v) =>
        v.quiet ? null : v.id === "all" ? `${DECIDED[v.decision]} (all)` : DECIDED[v.decision],
      error: "Couldn't apply that",
    },
  );

export const useSetStep = (brdId: string) =>
  useStudioWrite(brdId, (step: BrdStepId) => ({
    method: "post",
    path: `/brds/${brdId}/step`,
    body: { step },
  }));

export const useCapture = (brdId: string) =>
  useStudioWrite(
    brdId,
    (c: Capture) => ({ method: "post", path: `/brds/${brdId}/capture`, body: c }),
    "capture",
  );

/** Live editing on (the agent writes as it talks) or off (it proposes and waits). */
export const useAgentMode = (brdId: string) =>
  useStudioWrite(
    brdId,
    (autoApply: boolean) => ({ method: "post", path: `/brds/${brdId}/agent-mode`, body: { autoApply } }),
    "write",
    {
      success: (on) =>
        on
          ? { title: "Live edits on", description: "The agent writes into the document; undo any change." }
          : { title: "Ask first", description: "The agent suggests changes for you to accept or reject." },
    },
  );

export const useAddSource = (brdId: string) =>
  useStudioWrite(
    brdId,
    (s: AddSource) => ({ method: "post", path: `/brds/${brdId}/sources`, body: s }),
    "write",
    {
      success: (_s, data) => {
        const added = data.sources.at(-1);
        return added
          ? {
              title: `${added.id} attached · ${added.title}`,
              description:
                added.status === "ready"
                  ? `${added.passages.length} passage${added.passages.length === 1 ? "" : "s"} read`
                  : added.summary,
            }
          : null;
      },
      error: "Couldn't attach that",
    },
  );

export const useRemoveSource = (brdId: string) =>
  useStudioWrite(
    brdId,
    (id: string) => ({ method: "delete", path: `/brds/${brdId}/sources/${id}` }),
    "write",
    { success: (id) => `${id} removed`, error: "Couldn't remove the source" },
  );

export function useCreateBrd() {
  const { api, keys } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: NewBrd) => api.post("/brds", StudioState, v),
    onSuccess: (data) => {
      qc.setQueryData(keys.brdStudio(data.brd.id), data);
      void qc.invalidateQueries({ queryKey: keys.brds });
      void qc.invalidateQueries({ queryKey: keys.backlogs });
      void qc.invalidateQueries({ queryKey: keys.projects });
      void qc.invalidateQueries({ queryKey: keys.workItems });
    },
  });
}
