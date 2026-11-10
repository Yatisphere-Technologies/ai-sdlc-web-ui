import type { Membership, Session, Tenant } from "@throughline/contracts";

export type ResolvedTenant = { tenant: Tenant; membership: Membership };

/** A tenant is only resolvable if the user is a member. Unknown and forbidden look the same. */
export function resolveTenant(session: Session, slug: string): ResolvedTenant | null {
  const tenant = session.tenants.find((t) => t.slug === slug);
  if (!tenant) return null;
  const membership = session.memberships.find((m) => m.tenantId === tenant.id);
  if (!membership) return null;
  return { tenant, membership };
}

/**
 * acme.throughline.app → "acme" when baseDomain is "throughline.app".
 * Returns null for the bare domain, "www", localhost, IPs and other domains.
 */
export function tenantSlugFromHost(hostname: string, baseDomain: string): string | null {
  if (!baseDomain) return null;
  const host = hostname.toLowerCase();
  const base = baseDomain.toLowerCase();
  if (!host.endsWith(`.${base}`)) return null;
  const sub = host.slice(0, -(base.length + 1));
  if (!sub || sub.includes(".") || sub === "www" || sub === "app") return null;
  return sub;
}
