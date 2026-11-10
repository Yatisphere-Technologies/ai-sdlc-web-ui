import {
  ACTION_LABEL,
  type Action,
  AddDomain,
  AgentGovernance,
  type AuditEvent,
  AuditPage,
  IdentitySettings,
  InviteMember,
  KeyPolicy,
  KillSwitch,
  type Member,
  MemberList,
  RevokeKey,
  ROTATION_OPTIONS,
  ScimMappings,
  type SecurityControl,
  SecuritySettings,
  UpdateAgent,
  UpdateMember,
  UpdatePolicy,
  UpdateSecurityControl,
  UpdateSso,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { getSession } from "../db";
import { apiError, guardTenant } from "../guard";
import type { TenantSeed } from "../seed/types";
import { chainAppend, verifyChain } from "./chain";
import { CIDR, describe, inCidr } from "./controls";
import { findingsFor } from "./findings";
import { YOU } from "./seed";

const T = "/api/t/:tenantId";
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));
const now = () => new Date().toISOString();
const me = () => getSession().user;
const conflict = (message: string) => apiError(409, "conflict", message);
const invalid = (message: string) => apiError(400, "invalid", message);

/* ── Audit ───────────────────────────────────────────────────────────────────────────────────── */

type Entry = Pick<AuditEvent, "category" | "action" | "target" | "detail"> & {
  outcome?: AuditEvent["outcome"];
};

/** Every security-relevant write, and every refusal, lands in the tenant's hash-chained log. */
export function record(store: TenantSeed, e: Entry, actor?: AuditEvent["actor"]) {
  const user = me();
  chainAppend(store.audit, {
    at: now(),
    actor: actor ?? { type: "human", id: user.email, name: user.name },
    outcome: e.outcome ?? "success",
    ip: actor && actor.type !== "human" ? null : store.security.ip,
    category: e.category,
    action: e.action,
    target: e.target,
    detail: e.detail,
  });
}

/** guardTenant, plus a "denied" audit entry when the role lacks the permission. */
function guard(request: Request, tenantId: unknown, action?: Action, what = "settings") {
  const g = guardTenant(request, tenantId);
  if ("error" in g) return g;
  if (action && !g.membership.allowedActions.includes(action)) {
    record(g.store, {
      category: "security",
      action: "Change refused",
      target: what,
      detail: `Missing permission: ${ACTION_LABEL[action]}`,
      outcome: "denied",
    });
    return { error: apiError(403, "forbidden", "Your role in this workspace can't do that") } as const;
  }
  return g;
}

const slugOf = (tenantId: string) => getSession().tenants.find((t) => t.id === tenantId)?.slug ?? "";

/* ── Read models ─────────────────────────────────────────────────────────────────────────────── */

const security = (s: TenantSeed) =>
  SecuritySettings.parse({
    controls: s.security.controls,
    keys: s.security.keys,
    findings: findingsFor(s),
    currentIp: s.security.ip,
  });

const members = (s: TenantSeed) =>
  MemberList.parse({
    items: s.members.items,
    review: s.members.review,
    seats: {
      used: s.members.items.filter((m) => m.status !== "suspended").length,
      total: s.members.seatsTotal,
    },
    you: YOU,
  });

const identity = (s: TenantSeed, secret?: string) =>
  IdentitySettings.parse({ ...s.identity, ...(secret ? { secret } : {}) });

const agents = (s: TenantSeed) => AgentGovernance.parse(s.agentGov);

const activeAdmins = (s: TenantSeed) =>
  s.members.items.filter((m) => m.status === "active" && m.roles.includes("tenant-admin"));

const rolesFromGroups = (s: TenantSeed, groups: string[]) => [
  ...new Set(s.identity.scim.mappings.filter((m) => groups.includes(m.group)).flatMap((m) => m.roles)),
];

function token() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `scim_${Array.from(bytes, (b) => abc[b % abc.length]).join("")}`;
}

/* ── Control validation ──────────────────────────────────────────────────────────────────────── */

function applyControl(
  s: TenantSeed,
  c: SecurityControl,
  patch: { enabled?: boolean; config?: SecurityControl["config"] },
): SecurityControl | Response {
  const config = patch.config ?? c.config;
  const enabled = patch.enabled ?? c.enabled;
  if (patch.config && (!c.config || patch.config.kind !== c.config.kind))
    return invalid("That setting doesn't belong to this control");
  if (config?.kind === "ip-ranges") {
    const bad = config.ranges.find((r) => !CIDR.test(r.cidr));
    if (bad) return invalid(`${bad.cidr} isn't an IPv4 CIDR range like 203.0.113.0/24`);
    if (enabled && config.ranges.length === 0)
      return invalid("Add at least one range before turning this on");
    if (enabled && !config.ranges.some((r) => inCidr(s.security.ip, r.cidr)))
      return conflict(
        `This would lock you out: your address ${s.security.ip} isn't in any range. Add it, or turn the rule on from inside the network.`,
      );
  }
  if ((config?.kind === "hours" || config?.kind === "days") && !config.options.includes(config.value))
    return invalid("Choose one of the offered values");
  if (config?.kind === "categories" && enabled && !config.items.some((i) => i.enabled))
    return invalid("Redact at least one type of data, or turn the control off");
  if (config?.kind === "siem" && enabled && (!config.endpoint || config.endpoint === "not configured"))
    return invalid("Set the SIEM workspace or endpoint first");
  if (c.id === "scim" && enabled && !s.identity.scim.token)
    return conflict("Issue a SCIM token in SSO and SCIM and connect your identity provider first");
  return describe({ ...c, enabled, config });
}

/* ── Handlers ────────────────────────────────────────────────────────────────────────────────── */

export const securityHandlers = [
  /* Security and data */
  http.get(`${T}/security`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(security(g.store));
  }),

  http.patch(`${T}/security/controls/:controlId`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Security controls");
    if ("error" in g) return g.error;
    const body = UpdateSecurityControl.safeParse(await request.json());
    if (!body.success) return invalid(body.error.issues[0]?.message ?? "Invalid change");
    const c = g.store.security.controls.find((x) => x.id === params.controlId);
    if (!c) return apiError(404, "not_found", "No such control");
    const next = applyControl(g.store, c, body.data);
    if (next instanceof Response) return next;
    g.store.security.controls = g.store.security.controls.map((x) => (x.id === c.id ? next : x));
    if (c.id === "scim") g.store.identity.scim.enabled = next.enabled;
    record(g.store, {
      category: "security",
      action: body.data.enabled === undefined ? "Changed control" : next.enabled ? "Turned on" : "Turned off",
      target: next.label,
      detail: body.data.config ? next.description : next.enabled ? "Enabled" : "Disabled",
    });
    return HttpResponse.json(security(g.store));
  }),

  http.post(`${T}/security/keys/rotate`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Encryption key");
    if ("error" in g) return g.error;
    const k = g.store.security.keys;
    if (k.mode === "platform-key")
      return conflict(
        "This workspace uses a platform-managed key, rotated by Throughline. Bring your own key on Enterprise.",
      );
    if (k.status === "revoked") return conflict("Restore the key before rotating it");
    const n = Math.max(...k.versions.map((v) => Number(v.version.slice(1)))) + 1;
    g.store.security.keys = {
      ...k,
      rotatedAt: now(),
      versions: [
        { version: `v${n}`, createdAt: now(), by: me().name, reason: "Manual rotation", status: "active" },
        ...k.versions.map((v) => ({ ...v, status: "retired" as const })),
      ],
    };
    record(g.store, {
      category: "security",
      action: "Rotated key",
      target: k.keyRef,
      detail: `v${n} active; data keys re-wrapped, old version kept for decryption`,
    });
    return HttpResponse.json(security(g.store));
  }),

  http.put(`${T}/security/keys/policy`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Key rotation policy");
    if ("error" in g) return g.error;
    const body = KeyPolicy.safeParse(await request.json());
    if (!body.success || !(ROTATION_OPTIONS as readonly number[]).includes(body.data.rotationDays))
      return invalid(`Rotate every ${ROTATION_OPTIONS.join(", ")} days`);
    if (g.store.security.keys.mode === "platform-key")
      return conflict("Platform-managed keys follow the platform's policy");
    g.store.security.keys.rotationDays = body.data.rotationDays;
    record(g.store, {
      category: "security",
      action: "Changed rotation policy",
      target: g.store.security.keys.keyRef,
      detail: `Every ${body.data.rotationDays} days`,
    });
    return HttpResponse.json(security(g.store));
  }),

  http.post(`${T}/security/keys/revoke`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Encryption key");
    if ("error" in g) return g.error;
    const body = RevokeKey.safeParse(await request.json());
    if (!body.success || body.data.confirm !== slugOf(g.tenantId))
      return invalid("Type the workspace slug to confirm");
    if (g.store.security.keys.mode === "platform-key")
      return conflict("Only a customer-managed key can be revoked");
    g.store.security.keys = { ...g.store.security.keys, status: "revoked", revokedAt: now() };
    record(g.store, {
      category: "security",
      action: "Revoked key",
      target: g.store.security.keys.keyRef,
      detail: "Workspace data is unreadable until the key is restored",
    });
    return HttpResponse.json(security(g.store));
  }),

  http.post(`${T}/security/keys/restore`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Encryption key");
    if ("error" in g) return g.error;
    if (g.store.security.keys.status !== "revoked") return conflict("The key isn't revoked");
    g.store.security.keys = { ...g.store.security.keys, status: "active", revokedAt: null };
    record(g.store, {
      category: "security",
      action: "Restored key",
      target: g.store.security.keys.keyRef,
      detail: "Access to workspace data restored",
    });
    return HttpResponse.json(security(g.store));
  }),

  /* Members and roles */
  http.get(`${T}/members`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(members(g.store));
  }),

  http.post(`${T}/members`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "members.manage", "Members");
    if ("error" in g) return g.error;
    const body = InviteMember.safeParse(await request.json());
    if (!body.success) return invalid("Enter an email address and at least one role");
    const email = body.data.email.toLowerCase();
    const s = g.store;
    if (s.members.items.some((m) => m.email.toLowerCase() === email))
      return conflict(`${email} is already a member`);
    if (s.members.items.filter((m) => m.status !== "suspended").length >= s.members.seatsTotal)
      return conflict(`All ${s.members.seatsTotal} seats are in use. Remove someone or add seats.`);
    const domain = email.split("@")[1] ?? "";
    const verified = s.identity.sso.domains.filter((d) => d.verified).map((d) => d.domain);
    if (s.identity.sso.enforced && !verified.includes(domain))
      return conflict(
        `SSO is enforced, so members must sign in through ${s.identity.sso.provider}. ${domain} isn't a verified domain (${verified.join(", ")}).`,
      );
    const name = email
      .split("@")[0]
      ?.split(/[._-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");
    const m: Member = {
      id: `u_${Date.now().toString(36)}`,
      name: name ?? email,
      email,
      roles: body.data.roles,
      grants: [],
      status: "invited",
      source: "invite",
      mfa: false,
      breakGlass: false,
      groups: [],
      lastActiveAt: null,
      addedAt: now(),
    };
    s.members.items.push(m);
    record(s, {
      category: "access",
      action: "Invited member",
      target: email,
      detail: body.data.roles.join(", "),
    });
    return HttpResponse.json(members(s), { status: 201 });
  }),

  http.patch(`${T}/members/:memberId`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "members.manage", "Members");
    if ("error" in g) return g.error;
    const body = UpdateMember.safeParse(await request.json());
    if (!body.success) return invalid("Choose at least one role");
    const s = g.store;
    const m = s.members.items.find((x) => x.id === params.memberId);
    if (!m) return apiError(404, "not_found", "No such member");
    const { roles, status } = body.data;
    if (roles && m.source === "scim")
      return conflict(
        `${m.name}'s roles come from their ${s.identity.sso.provider} groups. Change the group there or the group mapping here.`,
      );
    if (m.id === YOU && ((roles && !roles.includes("tenant-admin")) || status === "suspended"))
      return conflict("You can't remove your own admin access. Ask another admin.");
    const losesAdmin =
      m.roles.includes("tenant-admin") &&
      ((roles && !roles.includes("tenant-admin")) || status === "suspended");
    if (losesAdmin && activeAdmins(s).length <= 1)
      return conflict("A workspace needs at least one active admin");
    if (status === "active" && m.status === "invited")
      return conflict("Invited people become active when they sign in");
    const next = { ...m, ...(roles ? { roles } : {}), ...(status ? { status } : {}) };
    s.members.items = s.members.items.map((x) => (x.id === m.id ? next : x));
    record(s, {
      category: "access",
      action:
        status === "suspended"
          ? "Suspended member"
          : status === "active"
            ? "Reinstated member"
            : "Changed roles",
      target: m.email,
      detail: roles
        ? `${m.roles.join(", ")} → ${roles.join(", ")}`
        : status === "suspended"
          ? "Sessions revoked"
          : "Access restored",
    });
    return HttpResponse.json(members(s));
  }),

  http.delete(`${T}/members/:memberId`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "members.manage", "Members");
    if ("error" in g) return g.error;
    const s = g.store;
    const m = s.members.items.find((x) => x.id === params.memberId);
    if (!m) return apiError(404, "not_found", "No such member");
    if (m.id === YOU) return conflict("You can't remove yourself");
    if (m.source === "scim" && s.identity.scim.enabled)
      return conflict(
        `${m.name} is synced by SCIM. Remove them in ${s.identity.sso.provider}; access ends at the next sync.`,
      );
    if (m.roles.includes("tenant-admin") && m.status === "active" && activeAdmins(s).length <= 1)
      return conflict("A workspace needs at least one active admin");
    s.members.items = s.members.items.filter((x) => x.id !== m.id);
    record(s, {
      category: "access",
      action: m.status === "invited" ? "Cancelled invite" : "Removed member",
      target: m.email,
      detail: "Sessions and tokens revoked",
    });
    return HttpResponse.json(members(s));
  }),

  http.post(`${T}/members/review`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "members.manage", "Access review");
    if ("error" in g) return g.error;
    const s = g.store;
    s.members.review = { ...s.members.review, lastAt: now(), by: me().name };
    record(s, {
      category: "access",
      action: "Certified access",
      target: `${s.members.items.length} members`,
      detail: `Access review completed; next due in ${s.members.review.everyDays} days`,
    });
    return HttpResponse.json(members(s));
  }),

  /* SSO and SCIM */
  http.get(`${T}/identity`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(identity(g.store));
  }),

  http.patch(`${T}/identity/sso`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Single sign-on");
    if ("error" in g) return g.error;
    const body = UpdateSso.safeParse(await request.json());
    if (!body.success) return invalid("Invalid SSO setting");
    const s = g.store;
    if (body.data.enforced) {
      if (!s.identity.sso.domains.some((d) => d.verified))
        return conflict("Verify at least one domain before enforcing SSO");
      if (!s.members.items.some((m) => m.breakGlass && m.status === "active" && m.mfa))
        return conflict(
          "Add an MFA-protected break-glass admin first, so the workspace isn't locked if the IdP is down",
        );
    }
    if (body.data.defaultRole === "tenant-admin")
      return invalid("New people can't become admins automatically");
    s.identity.sso = { ...s.identity.sso, ...body.data };
    const what = Object.entries(body.data)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
    record(s, { category: "identity", action: "Changed SSO", target: s.identity.sso.provider, detail: what });
    return HttpResponse.json(identity(s));
  }),

  http.post(`${T}/identity/domains`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Domains");
    if ("error" in g) return g.error;
    const body = AddDomain.safeParse(await request.json());
    if (!body.success) return invalid(body.error.issues[0]?.message ?? "Enter a domain");
    const domain = body.data.domain.toLowerCase();
    const s = g.store;
    if (s.identity.sso.domains.some((d) => d.domain === domain))
      return conflict(`${domain} is already added`);
    s.identity.sso.domains.push({
      domain,
      verified: false,
      record: `tl-verify=${g.tenantId.slice(2, 5)}-${Math.random().toString(16).slice(2, 8)}`,
      addedAt: now(),
    });
    record(s, {
      category: "identity",
      action: "Added domain",
      target: domain,
      detail: "Waiting for DNS TXT record",
    });
    return HttpResponse.json(identity(s), { status: 201 });
  }),

  /** Stand-in for the DNS lookup: the record is "found" unless the domain ends in .invalid. */
  http.post(`${T}/identity/domains/:domain/verify`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Domains");
    if ("error" in g) return g.error;
    const s = g.store;
    const d = s.identity.sso.domains.find((x) => x.domain === params.domain);
    if (!d) return apiError(404, "not_found", "No such domain");
    if (String(params.domain).endsWith(".invalid")) {
      record(s, {
        category: "identity",
        action: "Verification failed",
        target: d.domain,
        detail: "TXT record not found",
        outcome: "failure",
      });
      return conflict(`No TXT record "${d.record}" found on ${d.domain} yet. DNS can take up to an hour.`);
    }
    d.verified = true;
    record(s, {
      category: "identity",
      action: "Verified domain",
      target: d.domain,
      detail: `TXT ${d.record}`,
    });
    return HttpResponse.json(identity(s));
  }),

  http.delete(`${T}/identity/domains/:domain`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Domains");
    if ("error" in g) return g.error;
    const s = g.store;
    const d = s.identity.sso.domains.find((x) => x.domain === params.domain);
    if (!d) return apiError(404, "not_found", "No such domain");
    if (
      d.verified &&
      s.identity.sso.enforced &&
      s.identity.sso.domains.filter((x) => x.verified).length === 1
    )
      return conflict(
        "SSO is enforced on this domain. Stop enforcing SSO before removing the last verified domain.",
      );
    s.identity.sso.domains = s.identity.sso.domains.filter((x) => x !== d);
    record(s, { category: "identity", action: "Removed domain", target: d.domain, detail: "" });
    return HttpResponse.json(identity(s));
  }),

  http.post(`${T}/identity/scim/token`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "SCIM token");
    if ("error" in g) return g.error;
    const s = g.store;
    const secret = token();
    const created = new Date();
    const expires = new Date(created.getTime() + 180 * 86_400_000);
    const replaced = s.identity.scim.token;
    s.identity.scim.token = {
      last4: secret.slice(-4),
      createdAt: created.toISOString(),
      expiresAt: expires.toISOString(),
    };
    s.identity.scim.log.unshift({
      at: now(),
      level: "info",
      message: replaced ? `Token …${replaced.last4} replaced; it stops working now` : "Token issued",
    });
    record(s, {
      category: "identity",
      action: replaced ? "Rotated SCIM token" : "Issued SCIM token",
      target: `…${secret.slice(-4)}`,
      detail: replaced ? `Replaced …${replaced.last4}` : "Valid 180 days",
    });
    return HttpResponse.json(identity(s, secret));
  }),

  http.put(`${T}/identity/scim/mappings`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "Group mappings");
    if ("error" in g) return g.error;
    const body = ScimMappings.safeParse(await request.json());
    if (!body.success) return invalid("Every group needs a name and at least one role");
    const s = g.store;
    const groups = body.data.mappings.map((m) => m.group);
    if (new Set(groups).size !== groups.length) return invalid("Each group can be mapped once");
    const before = s.identity.scim.mappings;
    s.identity.scim.mappings = body.data.mappings;
    // Re-apply to synced members; never leave the workspace without an admin.
    const proposed = s.members.items.map((m) => {
      if (m.source !== "scim") return m;
      const roles = rolesFromGroups(s, m.groups);
      return { ...m, roles: roles.length ? roles : (["viewer"] as Member["roles"]) };
    });
    if (!proposed.some((m) => m.status === "active" && m.roles.includes("tenant-admin"))) {
      s.identity.scim.mappings = before;
      return conflict("That mapping would leave no active admin");
    }
    const changed = proposed.filter((m, i) => m.roles.join() !== s.members.items[i]?.roles.join());
    s.members.items = proposed;
    record(s, {
      category: "identity",
      action: "Changed group mappings",
      target: `${body.data.mappings.length} groups`,
      detail: changed.length
        ? `Roles changed for ${changed.map((m) => m.name).join(", ")}`
        : "No member's roles changed",
    });
    return HttpResponse.json(identity(s));
  }),

  http.post(`${T}/identity/scim/sync`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "security.manage", "SCIM sync");
    if ("error" in g) return g.error;
    const s = g.store;
    if (!s.identity.scim.enabled || !s.identity.scim.token)
      return conflict("Turn on SCIM and issue a token first");
    s.identity.scim.lastSyncAt = now();
    s.identity.scim.log.unshift({
      at: now(),
      level: "info",
      message: "Sync requested: 0 created, 0 updated, 0 removed",
    });
    record(
      s,
      {
        category: "identity",
        action: "Synced users",
        target: s.identity.sso.provider,
        detail: "Manual sync",
      },
      {
        type: "system",
        id: "scim",
        name: "scim",
      },
    );
    return HttpResponse.json(identity(s));
  }),

  /* Agents and policies */
  http.get(`${T}/agents`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(agents(g.store));
  }),

  http.patch(`${T}/agents/:agentId`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "policies.manage", "Agents");
    if ("error" in g) return g.error;
    const body = UpdateAgent.safeParse(await request.json());
    if (!body.success) return invalid("Invalid change");
    const s = g.store;
    const a = s.agentGov.agents.find((x) => x.id === params.agentId);
    if (!a) return apiError(404, "not_found", "No such agent");
    const next = { ...a, ...body.data };
    const policy = (id: string) => s.agentGov.policies.find((p) => p.id === id)?.enabled;
    if (body.data.status === "active" && s.agentGov.killSwitch.engaged)
      return conflict("The kill switch is engaged. Release it first.");
    if (next.autonomy === "act" && next.scopes.some((x) => x.includes("prod")) && policy("prod-approval"))
      return conflict(
        `${a.name} can change production, and "Production changes need a person" is on. It can act after approval at most.`,
      );
    if (next.dataAccess === "restricted") {
      const pii = s.security.controls.find((c) => c.id === "pii")?.enabled;
      if (!pii || !policy("redact"))
        return conflict(
          "Restricted data needs PII redaction on (Security and data) and the redaction guardrail on",
        );
    }
    s.agentGov.agents = s.agentGov.agents.map((x) => (x.id === a.id ? next : x));
    const what = Object.entries(body.data)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(", ");
    record(s, {
      category: "agent",
      action:
        body.data.status === "suspended"
          ? "Suspended agent"
          : body.data.status === "active"
            ? "Resumed agent"
            : "Changed agent",
      target: a.name,
      detail: what,
    });
    return HttpResponse.json(agents(s));
  }),

  http.patch(`${T}/policies/:policyId`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "policies.manage", "Agent guardrails");
    if ("error" in g) return g.error;
    const body = UpdatePolicy.safeParse(await request.json());
    if (!body.success) return invalid("Invalid change");
    const s = g.store;
    const p = s.agentGov.policies.find((x) => x.id === params.policyId);
    if (!p) return apiError(404, "not_found", "No such guardrail");
    if (
      p.id === "redact" &&
      body.data.enabled === false &&
      s.agentGov.agents.some((a) => a.dataAccess === "restricted" && a.status === "active")
    )
      return conflict("Agents with restricted access rely on this. Lower their data access first.");
    if (p.id === "prod-approval" && body.data.enabled === false)
      return conflict("Production approval is required by your G4 gate and can't be switched off here");
    const next = { ...p, ...body.data };
    s.agentGov.policies = s.agentGov.policies.map((x) => (x.id === p.id ? next : x));
    record(s, {
      category: "agent",
      action:
        body.data.enabled === false
          ? "Turned off guardrail"
          : body.data.enabled
            ? "Turned on guardrail"
            : "Changed guardrail",
      target: p.name,
      detail: body.data.enforcement ? `Enforcement: ${body.data.enforcement}` : "",
    });
    return HttpResponse.json(agents(s));
  }),

  http.post(`${T}/agents/kill-switch`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "policies.manage", "Kill switch");
    if ("error" in g) return g.error;
    const body = KillSwitch.safeParse(await request.json());
    if (!body.success) return invalid("Say why");
    const s = g.store;
    const gov = s.agentGov;
    if (body.data.engaged === gov.killSwitch.engaged)
      return conflict(gov.killSwitch.engaged ? "Agents are already stopped" : "Agents are already running");
    if (body.data.engaged) {
      gov.killed = gov.agents.filter((a) => a.status === "active").map((a) => a.id);
      gov.agents = gov.agents.map((a) => ({ ...a, status: "suspended" }));
      gov.killSwitch = { engaged: true, at: now(), by: me().name };
    } else {
      gov.agents = gov.agents.map((a) => (gov.killed.includes(a.id) ? { ...a, status: "active" } : a));
      gov.killed = [];
      gov.killSwitch = { engaged: false, at: now(), by: me().name };
    }
    record(s, {
      category: "agent",
      action: body.data.engaged ? "Stopped all agents" : "Released kill switch",
      target: "All agents",
      detail: body.data.reason,
    });
    return HttpResponse.json(agents(s));
  }),

  /* Audit log */
  http.get(`${T}/audit`, async ({ request, params }) => {
    await latency();
    const g = guard(request, params.tenantId, "audit.read", "Audit log");
    if ("error" in g) return g.error;
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    const category = url.searchParams.get("category");
    const actor = url.searchParams.get("actor");
    const outcome = url.searchParams.get("outcome");
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 1000);
    const offset = Number(url.searchParams.get("offset") ?? 0) || 0;
    const all = g.store.audit;
    const matched = [...all]
      .reverse()
      .filter(
        (e) =>
          (!category || e.category === category) &&
          (!actor || e.actor.type === actor) &&
          (!outcome || e.outcome === outcome) &&
          (!q || `${e.actor.name} ${e.action} ${e.target} ${e.detail}`.toLowerCase().includes(q)),
      );
    const brokenAt = verifyChain(all);
    const siem = g.store.security.controls.find((c) => c.id === "siem");
    const shipped = [...all].reverse().find((e) => e.action === "Shipped to SIEM");
    return HttpResponse.json(
      AuditPage.parse({
        items: matched.slice(offset, offset + limit),
        total: all.length,
        matched: matched.length,
        chain: {
          verified: brokenAt === null,
          events: all.length,
          head: all[all.length - 1]?.hash ?? "",
          brokenAt,
        },
        stream: {
          target: siem?.enabled && siem.config?.kind === "siem" ? siem.description : null,
          lastShippedAt: siem?.enabled ? (shipped?.at ?? null) : null,
        },
      }),
    );
  }),
];
