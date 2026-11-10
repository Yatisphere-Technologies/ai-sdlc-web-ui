import type { PageContext } from "@throughline/contracts";
import { MODULE_ROUTE, MODULES } from "@/features/modules";

/** Workspace-relative path, e.g. "/t/acme/testing?plan=x" → "/testing?plan=x". */
export function workspacePath(href: string, slug: string): string {
  const rest = href.replace(new RegExp(`^/t/${slug}`), "");
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/**
 * What the page is about when it didn't say: the module it belongs to, and the project the user is
 * working in. Pages can be more specific with useAssistantPageContext.
 */
export function routeContext(path: string, projectId: string | null, projectKey: string | null): PageContext {
  const pathname = path.split("?")[0] ?? "/";
  const project = pathname.match(/^\/projects\/([A-Z][A-Z0-9]+)$/)?.[1];
  if (project) return { label: `Project ${project}`, path, projectId };
  const program = pathname.match(/^\/projects\/program\/([A-Z0-9]+)$/)?.[1];
  if (program) return { label: `Program ${program}`, path, projectId: null };
  const brd = pathname.match(/^\/brd\/(BRD-\d+)/)?.[1];
  if (brd) return { label: brd, path, projectId };
  const mod = [...MODULES]
    .map((m) => ({ m, route: MODULE_ROUTE[m.id].replace("/t/$tenantSlug", "") || "/" }))
    .sort((a, b) => b.route.length - a.route.length)
    .find(({ route }) => (route === "/" ? pathname === "/" : pathname.startsWith(route)));
  const settings = pathname.startsWith("/settings") ? "Settings" : null;
  const label = mod ? mod.m.label : (settings ?? "Workspace");
  return {
    label: projectKey && label !== "Programs & projects" ? `${label} · ${projectKey}` : label,
    path,
    projectId,
  };
}
