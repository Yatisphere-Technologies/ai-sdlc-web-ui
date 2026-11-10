import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { requireSession } from "@/auth/session";
import { rememberTenant } from "./lastTenant";
import { resolveTenant } from "./resolveTenant";

/**
 * The tenancy boundary for any route under /t/$tenantSlug, including full-screen ones that sit
 * outside the app shell: requires a session, 404s for non-members, and returns the tenant context.
 */
export async function loadTenantRoute(queryClient: QueryClient, tenantSlug: string, href: string) {
  const session = await requireSession(queryClient, href);
  const resolved = resolveTenant(session, tenantSlug);
  if (!resolved) throw notFound();
  rememberTenant(resolved.tenant.slug);
  return resolved;
}
