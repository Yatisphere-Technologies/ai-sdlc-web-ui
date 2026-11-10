import { type QueryKey, useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "@throughline/ui";
import type { z } from "zod";
import { useTenant } from "@/tenancy";

/** What a write tells the user: a success toast (or none) and an error toast title. */
export type Notify<V, D> = {
  success?: (vars: V, data: D) => string | { title: string; description?: string } | null;
  /** Title of the error toast; the server's message is the description. */
  error?: string;
};

/** Shows the toasts a write asked for. */
export function notifySuccess<V, D>(n: Notify<V, D> | undefined, vars: V, data: D) {
  const m = n?.success?.(vars, data);
  if (!m) return;
  if (typeof m === "string") toast.success(m);
  else toast.success(m.title, { description: m.description });
}
export function notifyError<V, D>(n: Notify<V, D> | undefined, err: unknown) {
  if (!n?.error) return;
  toast.error(n.error, { description: err instanceof Error ? err.message : undefined });
}

/** Suspense query against a tenant-scoped endpoint, validated with the shared contract. */
export function useTenantData<S extends z.ZodType>(
  key: QueryKey,
  path: `/${string}`,
  schema: S,
  options: { refetchInterval?: (data: z.infer<S> | undefined) => number | false } = {},
) {
  const { api } = useTenant();
  return useSuspenseQuery({
    queryKey: key,
    queryFn: () => api.get(path, schema),
    refetchInterval: options.refetchInterval
      ? (q) => options.refetchInterval?.(q.state.data as z.infer<S>) ?? false
      : undefined,
  }).data as z.infer<S>;
}

/**
 * Tenant-scoped write whose response is the new state of `key`. The server's answer replaces the
 * cache, so the screen always shows what the server actually stored.
 */
export function useTenantWrite<S extends z.ZodType, V>(
  key: QueryKey,
  schema: S,
  request: (vars: V) => { method: "post" | "patch" | "put" | "delete"; path: `/${string}`; body?: unknown },
  /** Other cached views this write makes stale (refetched after success). */
  invalidate: QueryKey[] = [],
  notify?: Notify<V, z.infer<S>>,
) {
  const { api, keys } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: V) => {
      const r = request(vars);
      if (r.method === "post") return api.post(r.path, schema, r.body);
      if (r.method === "put") return api.put(r.path, schema, r.body ?? {});
      if (r.method === "delete") return api.delete(r.path, schema);
      return api.patch(r.path, schema, r.body ?? {});
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(key, data);
      for (const k of invalidate) void queryClient.invalidateQueries({ queryKey: k });
      // Project views are built from every other kind of data, so any write can change them.
      void queryClient.invalidateQueries({ queryKey: keys.projects });
      notifySuccess(notify, vars, data);
    },
    onError: (err) => notifyError(notify, err),
  });
}
