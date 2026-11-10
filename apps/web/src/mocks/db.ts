import {
  actionsFor,
  type Membership,
  type Session,
  type Tenant,
  type TenantId,
} from "@throughline/contracts";
import { YOU } from "./security/seed";
import { acmeSeed, acmeTenant } from "./seed/acme";
import { fabrikamSeed, fabrikamTenant } from "./seed/fabrikam";
import { northwindSeed, northwindTenant } from "./seed/northwind";
import type { TenantSeed } from "./seed/types";

/**
 * In-memory stand-in for the backend. Data is partitioned by tenant id; the only way to reach a
 * tenant's data is getStore(tenantId), and handlers only call that after the tenancy guard passes.
 */
const seeds: ReadonlyArray<[Tenant, TenantSeed]> = [
  [acmeTenant, acmeSeed],
  [northwindTenant, northwindSeed],
  [fabrikamTenant, fabrikamSeed],
];

/** A tenant that exists on the platform but this user is NOT a member of. Used to prove isolation. */
export const FOREIGN_TENANT_ID: TenantId = "t_other9z";

let stores = new Map<TenantId, TenantSeed>();

/** When each review pack started generating, so reads can report progress like a real job. */
export const generationStartedAt = new Map<string, number>();

/**
 * Mock sign-in state. Kept in localStorage so a refresh keeps you signed in, with an in-memory
 * fallback when storage is blocked. The real app uses an HTTP-only session cookie from the BFF.
 */
const AUTH_KEY = "throughline.mock.signedIn";
let signedInMemory = false;

export function isSignedIn() {
  try {
    return localStorage.getItem(AUTH_KEY) === "1";
  } catch {
    return signedInMemory;
  }
}

export function setSignedIn(value: boolean) {
  signedInMemory = value;
  try {
    if (value) localStorage.setItem(AUTH_KEY, "1");
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    /* storage blocked: memory fallback only */
  }
}

export function resetDb() {
  generationStartedAt.clear();
  stores = new Map(seeds.map(([t, s]) => [t.id, structuredClone(s)]));
  // Same data shape as Fabrikam, but the signed-in user is not a member.
  const foreign = structuredClone(fabrikamSeed);
  foreign.members.items = foreign.members.items.filter((m) => m.id !== YOU);
  stores.set(FOREIGN_TENANT_ID, foreign);
}
resetDb();

export function getStore(tenantId: TenantId): TenantSeed | undefined {
  return stores.get(tenantId);
}

/**
 * The signed-in user's membership comes from their member record in each workspace, so a role
 * change in Settings → Members and roles changes what they can do. Suspended means no access.
 */
export function getMembership(tenantId: TenantId): Membership | undefined {
  const me = stores.get(tenantId)?.members.items.find((m) => m.id === YOU);
  if (me?.status !== "active") return undefined;
  return { tenantId, roles: me.roles, allowedActions: actionsFor(me.roles, me.grants) };
}

export function getSession(): Session {
  return {
    user: { id: YOU, name: "Priya Nair", email: "priya.nair@example.com", initials: "PN" },
    tenants: seeds.map(([t]) => t).filter((t) => getMembership(t.id)),
    memberships: seeds.flatMap(([t]) => getMembership(t.id) ?? []),
  };
}
