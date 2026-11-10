import { z } from "zod";

/**
 * Tenancy contract. Every tenant-scoped request carries the tenant id twice:
 * in the path (/api/t/{tenantId}/…) and in the X-Tenant-Id header. The server rejects any mismatch.
 */
export const TENANT_HEADER = "X-Tenant-Id";

export const TenantId = z.string().regex(/^t_[a-z0-9]{6,}$/, "Tenant ids look like t_acme7f");
export type TenantId = z.infer<typeof TenantId>;

export const TenantSlug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/);
export type TenantSlug = z.infer<typeof TenantSlug>;

export const Region = z.enum(["in-mumbai", "in-hyderabad", "ae-dubai", "eu-frankfurt", "us-virginia"]);
export type Region = z.infer<typeof Region>;

/** How strongly a tenant is separated from others. */
export const Isolation = z.enum(["pooled", "isolated", "dedicated", "customer-cloud"]);
export type Isolation = z.infer<typeof Isolation>;

export const Plan = z.enum(["team", "business", "enterprise"]);
export type Plan = z.infer<typeof Plan>;

export const Tenant = z.object({
  id: TenantId,
  slug: TenantSlug,
  name: z.string().min(1),
  plan: Plan,
  region: Region,
  isolation: Isolation,
  encryption: z.enum(["platform-key", "customer-key"]),
  identityProvider: z.string(),
  /** Feature flags switched on for this tenant */
  features: z.array(z.string()),
});
export type Tenant = z.infer<typeof Tenant>;

/** Everything a user may do in a tenant. The UI shows what is allowed; the server enforces it. */
export const Action = z.enum([
  "gate.approve.g0",
  "gate.approve.g1",
  "gate.approve.g2",
  "gate.approve.g3",
  "gate.approve.g4",
  "work.create",
  "integrations.manage",
  "security.manage",
  "policies.manage",
  "review.security.signoff",
  "incident.approve",
  "architecture.edit",
  "brd.edit",
  "brd.approve",
  "members.manage",
  "audit.read",
]);
export type Action = z.infer<typeof Action>;

export const Role = z.enum([
  "tenant-admin",
  "product-owner",
  "architect",
  "tech-lead",
  "release-manager",
  "engineer",
  "viewer",
]);
export type Role = z.infer<typeof Role>;

export const Membership = z.object({
  tenantId: TenantId,
  roles: z.array(Role).min(1),
  allowedActions: z.array(Action),
});
export type Membership = z.infer<typeof Membership>;

export const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  initials: z.string().max(3),
});
export type User = z.infer<typeof User>;

/** GET /api/me: who is signed in and which tenants they can enter. Not tenant-scoped. */
export const Session = z.object({
  user: User,
  tenants: z.array(Tenant),
  memberships: z.array(Membership),
});
export type Session = z.infer<typeof Session>;

export const REGION_LABEL: Record<Region, string> = {
  "in-mumbai": "India · Mumbai",
  "in-hyderabad": "India · Hyderabad",
  "ae-dubai": "UAE · Dubai",
  "eu-frankfurt": "EU · Frankfurt",
  "us-virginia": "US · Virginia",
};

export const ISOLATION_LABEL: Record<Isolation, string> = {
  pooled: "Pooled",
  isolated: "Isolated tenant",
  dedicated: "Dedicated stack",
  "customer-cloud": "Your cloud",
};

export const PLAN_LABEL: Record<Plan, string> = {
  team: "Team",
  business: "Business",
  enterprise: "Enterprise",
};

/** Path prefix for every tenant-scoped API call. */
export function tenantApiPath(tenantId: TenantId, path: `/${string}`) {
  return `/api/t/${tenantId}${path}`;
}

/** POST /api/auth/login. In production this starts an OIDC redirect via the backend-for-frontend. */
export const IdentityProvider = z.enum(["entra", "okta", "google", "sso-email"]);
export type IdentityProvider = z.infer<typeof IdentityProvider>;

export const LoginRequest = z.object({ provider: IdentityProvider, email: z.email().optional() });
export type LoginRequest = z.infer<typeof LoginRequest>;
