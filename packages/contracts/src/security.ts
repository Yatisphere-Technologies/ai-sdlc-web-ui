import { z } from "zod";
import { Action, Role } from "./tenancy";

/* ── Roles and permissions ───────────────────────────────────────────────────────────────────────
 * A member's permissions are the union of their roles' actions plus any direct grants. The same
 * table drives the server (memberships) and the role matrix in Settings → Members and roles.
 */

export const ROLE_LABEL: Record<Role, string> = {
  "tenant-admin": "Workspace admin",
  "product-owner": "Product owner",
  architect: "Architect",
  "tech-lead": "Tech lead",
  "release-manager": "Release manager",
  engineer: "Engineer",
  viewer: "Viewer",
};

export const ROLE_ACTIONS: Record<Role, readonly Action[]> = {
  "tenant-admin": [
    "integrations.manage",
    "security.manage",
    "policies.manage",
    "members.manage",
    "audit.read",
  ],
  "product-owner": [
    "gate.approve.g0",
    "gate.approve.g1",
    "gate.approve.g4",
    "work.create",
    "brd.edit",
    "brd.approve",
    "incident.approve",
  ],
  architect: ["gate.approve.g2", "architecture.edit"],
  "tech-lead": ["gate.approve.g3", "work.create", "architecture.edit"],
  "release-manager": ["gate.approve.g4", "incident.approve"],
  engineer: ["work.create"],
  viewer: [],
};

export const ACTION_LABEL: Record<Action, string> = {
  "gate.approve.g0": "Approve G0 · shape",
  "gate.approve.g1": "Approve G1 · spec",
  "gate.approve.g2": "Approve G2 · architecture",
  "gate.approve.g3": "Approve G3 · verify",
  "gate.approve.g4": "Approve G4 · release",
  "work.create": "Create and change work",
  "integrations.manage": "Manage integrations",
  "security.manage": "Manage security and identity",
  "policies.manage": "Manage agents and policies",
  "review.security.signoff": "Sign security reviews",
  "incident.approve": "Approve incident fixes",
  "architecture.edit": "Edit architecture",
  "brd.edit": "Edit BRDs",
  "brd.approve": "Sign off BRDs",
  "members.manage": "Manage members and roles",
  "audit.read": "Read the audit log",
};

export function actionsFor(roles: readonly Role[], grants: readonly Action[] = []): Action[] {
  return [...new Set([...roles.flatMap((r) => ROLE_ACTIONS[r]), ...grants])];
}

/* ── Members ─────────────────────────────────────────────────────────────────────────────────── */

export const Member = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  roles: z.array(Role).min(1),
  /** Actions granted on top of the roles. */
  grants: z.array(Action),
  status: z.enum(["active", "invited", "suspended"]),
  /** How they got here: synced by SCIM, invited by an admin, or created on first SSO sign-in. */
  source: z.enum(["scim", "invite", "jit"]),
  mfa: z.boolean(),
  /** Emergency account that can sign in when SSO is down. */
  breakGlass: z.boolean(),
  groups: z.array(z.string()),
  lastActiveAt: z.string().nullable(),
  addedAt: z.string(),
});
export type Member = z.infer<typeof Member>;

export const AccessReview = z.object({
  lastAt: z.string().nullable(),
  by: z.string().nullable(),
  everyDays: z.number().int(),
});

export const MemberList = z.object({
  items: z.array(Member),
  review: AccessReview,
  seats: z.object({ used: z.number().int(), total: z.number().int() }),
  /** The signed-in user's member id in this workspace. */
  you: z.string(),
});
export type MemberList = z.infer<typeof MemberList>;

export const InviteMember = z.object({ email: z.email(), roles: z.array(Role).min(1) });
export const UpdateMember = z.object({
  roles: z.array(Role).min(1).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

/* ── SSO and SCIM ────────────────────────────────────────────────────────────────────────────── */

export const Domain = z.object({
  domain: z.string(),
  verified: z.boolean(),
  /** DNS TXT record to publish to prove ownership. */
  record: z.string(),
  addedAt: z.string(),
});
export type Domain = z.infer<typeof Domain>;

export const SsoSettings = z.object({
  protocol: z.enum(["oidc", "saml"]),
  provider: z.string(),
  issuer: z.string(),
  clientId: z.string(),
  domains: z.array(Domain),
  /** Everyone on a verified domain must sign in through the IdP; break-glass accounts excepted. */
  enforced: z.boolean(),
  /** Create a member on first SSO sign-in. */
  jit: z.boolean(),
  defaultRole: Role,
  lastLoginAt: z.string().nullable(),
});
export type SsoSettings = z.infer<typeof SsoSettings>;

export const ScimSettings = z.object({
  enabled: z.boolean(),
  endpoint: z.string(),
  token: z.object({ last4: z.string(), createdAt: z.string(), expiresAt: z.string() }).nullable(),
  lastSyncAt: z.string().nullable(),
  users: z.number().int(),
  groups: z.number().int(),
  /** IdP group → workspace roles. SCIM members get exactly the roles of their groups. */
  mappings: z.array(z.object({ group: z.string(), roles: z.array(Role).min(1) })),
  log: z.array(z.object({ at: z.string(), level: z.enum(["info", "warn", "error"]), message: z.string() })),
});
export type ScimSettings = z.infer<typeof ScimSettings>;

export const IdentitySettings = z.object({
  sso: SsoSettings,
  scim: ScimSettings,
  /** Only present in the response that issued a new SCIM token; shown once. */
  secret: z.string().optional(),
});
export type IdentitySettings = z.infer<typeof IdentitySettings>;

export const UpdateSso = z.object({
  enforced: z.boolean().optional(),
  jit: z.boolean().optional(),
  defaultRole: Role.optional(),
});
export const AddDomain = z.object({
  domain: z.string().regex(/^(?!-)[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/i, "Enter a domain like example.com"),
});
export const ScimMappings = z.object({
  mappings: z.array(z.object({ group: z.string().min(1), roles: z.array(Role).min(1) })),
});

/* ── Agents and policies ─────────────────────────────────────────────────────────────────────── */

export const DataClass = z.enum(["public", "internal", "confidential", "restricted"]);
export type DataClass = z.infer<typeof DataClass>;
export const DATA_CLASS_LABEL: Record<DataClass, string> = {
  public: "Public",
  internal: "Internal",
  confidential: "Confidential",
  restricted: "Restricted",
};

export const Autonomy = z.enum(["suggest", "approve", "act"]);
export type Autonomy = z.infer<typeof Autonomy>;
export const AUTONOMY_LABEL: Record<Autonomy, string> = {
  suggest: "Suggest only",
  approve: "Act after approval",
  act: "Act, then report",
};

export const AgentIdentity = z.object({
  id: z.string(),
  code: z.string().max(2),
  name: z.string(),
  purpose: z.string(),
  /** Workload identity the agent signs in with, e.g. an Entra Agent ID. */
  identity: z.string(),
  credential: z.object({ type: z.enum(["federated", "managed-identity", "secret"]), rotatedAt: z.string() }),
  owner: z.string(),
  status: z.enum(["active", "suspended"]),
  autonomy: Autonomy,
  /** Highest data classification it may read. */
  dataAccess: DataClass,
  scopes: z.array(z.string()),
  /** MCP servers and tools it may call. */
  tools: z.array(z.string()),
  model: z.string(),
  budgetUsd: z.number().nonnegative(),
  spentUsd: z.number().nonnegative(),
  actions30d: z.number().int(),
  denied30d: z.number().int(),
  lastActionAt: z.string().nullable(),
});
export type AgentIdentity = z.infer<typeof AgentIdentity>;

export const AgentPolicy = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["code", "data", "release", "spend", "tools"]),
  enforcement: z.enum(["block", "approve", "log"]),
  enabled: z.boolean(),
  /** Times it stepped in over the last 30 days. */
  hits30d: z.number().int(),
  frameworks: z.array(z.string()),
});
export type AgentPolicy = z.infer<typeof AgentPolicy>;
export const ENFORCEMENT_LABEL: Record<AgentPolicy["enforcement"], string> = {
  block: "Block",
  approve: "Require approval",
  log: "Log only",
};

export const AgentGovernance = z.object({
  agents: z.array(AgentIdentity),
  policies: z.array(AgentPolicy),
  killSwitch: z.object({ engaged: z.boolean(), at: z.string().nullable(), by: z.string().nullable() }),
});
export type AgentGovernance = z.infer<typeof AgentGovernance>;

export const UpdateAgent = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  autonomy: Autonomy.optional(),
  dataAccess: DataClass.optional(),
  budgetUsd: z.number().nonnegative().optional(),
});
export const UpdatePolicy = z.object({
  enabled: z.boolean().optional(),
  enforcement: AgentPolicy.shape.enforcement.optional(),
});
export const KillSwitch = z.object({ engaged: z.boolean(), reason: z.string().min(3) });

/* ── Audit log ───────────────────────────────────────────────────────────────────────────────── */

export const AuditCategory = z.enum([
  "access",
  "security",
  "identity",
  "agent",
  "data",
  "gate",
  "integration",
]);
export type AuditCategory = z.infer<typeof AuditCategory>;
export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  access: "Access",
  security: "Security",
  identity: "Identity",
  agent: "Agents",
  data: "Data",
  gate: "Gates",
  integration: "Integrations",
};

export const AuditEvent = z.object({
  id: z.string(),
  seq: z.number().int(),
  at: z.string(),
  actor: z.object({ type: z.enum(["human", "agent", "system"]), id: z.string(), name: z.string() }),
  category: AuditCategory,
  action: z.string(),
  target: z.string(),
  outcome: z.enum(["success", "denied", "failure"]),
  ip: z.string().nullable(),
  detail: z.string(),
  /** Hash of the previous event; chaining makes any edit or deletion detectable. */
  prev: z.string(),
  hash: z.string(),
});
export type AuditEvent = z.infer<typeof AuditEvent>;

export const AuditPage = z.object({
  items: z.array(AuditEvent),
  total: z.number().int(),
  matched: z.number().int(),
  chain: z.object({
    verified: z.boolean(),
    events: z.number().int(),
    head: z.string(),
    brokenAt: z.number().nullable(),
  }),
  stream: z.object({ target: z.string().nullable(), lastShippedAt: z.string().nullable() }),
});
export type AuditPage = z.infer<typeof AuditPage>;
