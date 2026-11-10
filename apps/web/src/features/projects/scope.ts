import { useCallback, useSyncExternalStore } from "react";

/**
 * The project the person is working in, per tenant and per browser. Module pages (BRD,
 * Architecture, Portfolio, Trace) show only that project's items when one is chosen; null means
 * all projects. Opening a project page sets it.
 */
const KEY = (tenantId: string) => `throughline.project.${tenantId}`;
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();

function read(tenantId: string): string | null {
  try {
    return localStorage.getItem(KEY(tenantId));
  } catch {
    return memory.get(tenantId) ?? null;
  }
}

export function setProjectScope(tenantId: string, projectId: string | null) {
  memory.set(tenantId, projectId);
  try {
    if (projectId) localStorage.setItem(KEY(tenantId), projectId);
    else localStorage.removeItem(KEY(tenantId));
  } catch {
    /* storage blocked: memory only */
  }
  for (const l of listeners) l();
}

export function useProjectScope(tenantId: string): [string | null, (id: string | null) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => read(tenantId),
    () => null,
  );
  const set = useCallback((id: string | null) => setProjectScope(tenantId, id), [tenantId]);
  return [value, set];
}

/** Keeps items of the chosen project; everything when no project is chosen. */
export function inScope<T>(
  items: T[],
  scope: string | null,
  projectOf: (item: T) => string | undefined,
): T[] {
  return scope ? items.filter((x) => projectOf(x) === scope) : items;
}
