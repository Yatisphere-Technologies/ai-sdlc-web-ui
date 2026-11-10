import type { SecurityFinding } from "@throughline/contracts";
import type { TenantSeed } from "../seed/types";

const DAY = 86_400_000;
const days = (iso: string | null, now: number) =>
  iso ? Math.floor((now - Date.parse(iso)) / DAY) : Infinity;

/** What weakens this workspace right now, worst first, each pointing at the tab that fixes it. */
export function findingsFor(store: TenantSeed, now = Date.now()): SecurityFinding[] {
  const out: SecurityFinding[] = [];
  const add = (f: SecurityFinding) => out.push(f);
  const { keys } = store.security;
  const members = store.members.items;
  const active = members.filter((m) => m.status === "active");
  const { sso, scim } = store.identity;

  if (keys.status === "revoked")
    add({
      id: "key-revoked",
      severity: "high",
      title: "Encryption key revoked",
      detail:
        "Workspace data can't be decrypted. Restore the key within the soft-delete window or it is lost.",
      tab: "security",
    });
  else if (keys.mode === "customer-key" && days(keys.rotatedAt, now) > keys.rotationDays)
    add({
      id: "key-overdue",
      severity: "medium",
      title: "Encryption key overdue for rotation",
      detail: `Last rotated ${days(keys.rotatedAt, now)} days ago; policy is every ${keys.rotationDays} days.`,
      tab: "security",
    });

  const noMfaAdmins = active.filter((m) => !m.mfa && m.roles.includes("tenant-admin"));
  const noMfa = active.filter((m) => !m.mfa && !m.roles.includes("tenant-admin"));
  if (noMfaAdmins.length)
    add({
      id: "admin-no-mfa",
      severity: "high",
      title: `${noMfaAdmins.length} admin${noMfaAdmins.length === 1 ? "" : "s"} without MFA`,
      detail: noMfaAdmins.map((m) => m.name).join(", "),
      tab: "members",
    });
  if (noMfa.length)
    add({
      id: "no-mfa",
      severity: "medium",
      title: `${noMfa.length} member${noMfa.length === 1 ? "" : "s"} without MFA`,
      detail: noMfa.map((m) => m.name).join(", "),
      tab: "members",
    });

  const stale = active.filter((m) => !m.breakGlass && days(m.lastActiveAt, now) > 90);
  if (stale.length)
    add({
      id: "inactive",
      severity: "medium",
      title: `${stale.length} member${stale.length === 1 ? "" : "s"} inactive for 90+ days`,
      detail: `${stale.map((m) => m.name).join(", ")}. Suspend or remove them.`,
      tab: "members",
    });

  const review = store.members.review;
  if (days(review.lastAt, now) > review.everyDays)
    add({
      id: "review-due",
      severity: "medium",
      title: "Access review overdue",
      detail: review.lastAt
        ? `Last certified ${days(review.lastAt, now)} days ago; due every ${review.everyDays} days.`
        : "Nobody has certified who has access yet.",
      tab: "members",
    });

  if (!active.some((m) => m.breakGlass))
    add({
      id: "no-break-glass",
      severity: sso.enforced ? "high" : "low",
      title: "No break-glass account",
      detail: "Keep one MFA-protected admin outside SSO for when the identity provider is down.",
      tab: "members",
    });

  if (!sso.enforced)
    add({
      id: "sso-off",
      severity: "medium",
      title: "SSO isn't enforced",
      detail: "People can still sign in without your identity provider's policies.",
      tab: "sso",
    });
  const unverified = sso.domains.filter((d) => !d.verified);
  if (unverified.length)
    add({
      id: "domain-unverified",
      severity: "low",
      title: `${unverified.length} domain${unverified.length === 1 ? "" : "s"} not verified`,
      detail: unverified.map((d) => d.domain).join(", "),
      tab: "sso",
    });
  if (scim.enabled && scim.token && days(scim.token.expiresAt, now) > -30)
    add({
      id: "scim-token",
      severity: days(scim.token.expiresAt, now) > 0 ? "high" : "low",
      title: days(scim.token.expiresAt, now) > 0 ? "SCIM token expired" : "SCIM token expires soon",
      detail: `Token …${scim.token.last4} expires ${scim.token.expiresAt.slice(0, 10)}. Issue a new one and update your IdP.`,
      tab: "sso",
    });

  const gov = store.agentGov;
  const secrets = gov.agents.filter((a) => a.credential.type === "secret" && a.status === "active");
  if (secrets.length)
    add({
      id: "agent-secret",
      severity: "medium",
      title: `${secrets.length} agent${secrets.length === 1 ? " uses" : "s use"} a long-lived secret`,
      detail: `${secrets.map((a) => a.name).join(", ")}. Move to a federated or managed identity.`,
      tab: "agents",
    });
  const over = gov.agents.filter((a) => a.spentUsd > a.budgetUsd);
  if (over.length)
    add({
      id: "agent-budget",
      severity: "low",
      title: `${over.length} agent${over.length === 1 ? "" : "s"} over budget`,
      detail: over.map((a) => a.name).join(", "),
      tab: "agents",
    });
  const offGuards = gov.policies.filter((p) => !p.enabled);
  if (offGuards.length)
    add({
      id: "policies-off",
      severity: offGuards.some((p) => p.enforcement === "block") ? "medium" : "low",
      title: `${offGuards.length} agent guardrail${offGuards.length === 1 ? "" : "s"} switched off`,
      detail: offGuards.map((p) => p.name).join("; "),
      tab: "agents",
    });
  if (gov.killSwitch.engaged)
    add({
      id: "kill-switch",
      severity: "low",
      title: "Agents are stopped",
      detail: "The kill switch is engaged; no agent can act until it is released.",
      tab: "agents",
    });

  const order = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}
