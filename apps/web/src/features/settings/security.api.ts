import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AgentGovernance,
  AuditPage,
  type ControlConfig,
  IdentitySettings,
  MemberList,
  type Role,
  SecuritySettings,
} from "@throughline/contracts";
import type { z } from "zod";
import { type Notify, useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

/* Reads */
export const useSecurity = () => {
  const { keys } = useTenant();
  return useTenantData(keys.security, "/security", SecuritySettings);
};
export const useMembers = () => {
  const { keys } = useTenant();
  return useTenantData(keys.members, "/members", MemberList);
};
export const useIdentity = () => {
  const { keys } = useTenant();
  return useTenantData(keys.identity, "/identity", IdentitySettings);
};
export const useAgentGov = () => {
  const { keys } = useTenant();
  return useTenantData(keys.agentGov, "/agents", AgentGovernance);
};
export const useAudit = (query: string) => {
  const { keys } = useTenant();
  return useTenantData(keys.audit(query), `/audit?${query}`, AuditPage);
};

/** Every security write can change findings elsewhere and always adds an audit event. */
function useSecWrite<S extends z.ZodType, V>(
  key: QueryKey,
  schema: S,
  request: Parameters<typeof useTenantWrite<S, V>>[2],
  notify?: Notify<V, z.infer<S>>,
) {
  const { keys } = useTenant();
  const others = [keys.security, keys.members, keys.identity, keys.agentGov, keys.auditAll].filter(
    (k) => k.join() !== (key as readonly unknown[]).join(),
  );
  return useTenantWrite(key, schema, request, others, notify);
}

/* Security and data */
export function useToggleControl() {
  const { api, keys } = useTenant();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/security/controls/${id}`, SecuritySettings, { enabled }),
    // Optimistic: flip immediately, roll back if the server refuses.
    onMutate: async ({ id, enabled }) => {
      await queryClient.cancelQueries({ queryKey: keys.security });
      const prev = queryClient.getQueryData<SecuritySettings>(keys.security);
      if (prev)
        queryClient.setQueryData<SecuritySettings>(keys.security, {
          ...prev,
          controls: prev.controls.map((c) => (c.id === id ? { ...c, enabled } : c)),
        });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(keys.security, ctx.prev);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(keys.security, data);
      void queryClient.invalidateQueries({ queryKey: keys.auditAll });
      void queryClient.invalidateQueries({ queryKey: keys.identity });
    },
  });
}

export function useConfigureControl() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.security,
    SecuritySettings,
    (v: { id: string; config: ControlConfig; enabled?: boolean }) => ({
      method: "patch",
      path: `/security/controls/${v.id}`,
      body: { config: v.config, enabled: v.enabled },
    }),
    { success: () => "Control updated", error: "Couldn't change the control" },
  );
}

export function useKeyAction() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.security,
    SecuritySettings,
    (v: { action: "rotate" | "revoke" | "restore"; confirm?: string }) => ({
      method: "post",
      path: `/security/keys/${v.action}`,
      body: v.confirm ? { confirm: v.confirm } : undefined,
    }),
    {
      success: (v, d) =>
        v.action === "rotate"
          ? `Key rotated · ${d.keys.versions[0]?.version ?? ""} active`
          : v.action === "revoke"
            ? "Key revoked"
            : "Key restored",
      error: "Couldn't change the key",
    },
  );
}

export function useKeyPolicy() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.security,
    SecuritySettings,
    (v: { rotationDays: number }) => ({ method: "put", path: "/security/keys/policy", body: v }),
    { success: (v) => `Rotating every ${v.rotationDays} days`, error: "Couldn't change the policy" },
  );
}

/* Members */
export function useInvite() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.members,
    MemberList,
    (v: { email: string; roles: Role[] }) => ({ method: "post", path: "/members", body: v }),
    { success: (v) => `Invitation sent to ${v.email}`, error: "Couldn't invite" },
  );
}
export function useUpdateMember() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.members,
    MemberList,
    (v: { id: string; roles?: Role[]; status?: "active" | "suspended" }) => ({
      method: "patch",
      path: `/members/${v.id}`,
      body: { roles: v.roles, status: v.status },
    }),
    {
      success: (v) =>
        v.status === "suspended" ? "Suspended; sessions revoked" : v.status ? "Reinstated" : "Roles changed",
      error: "Couldn't change the member",
    },
  );
}
export function useRemoveMember() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.members,
    MemberList,
    (v: { id: string }) => ({ method: "delete", path: `/members/${v.id}` }),
    { success: () => "Removed; sessions and tokens revoked", error: "Couldn't remove" },
  );
}
export function useCertifyAccess() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.members,
    MemberList,
    (_v: undefined) => ({ method: "post", path: "/members/review" }),
    {
      success: () => "Access review recorded",
      error: "Couldn't record the review",
    },
  );
}

/* SSO and SCIM */
export function useUpdateSso() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.identity,
    IdentitySettings,
    (v: { enforced?: boolean; jit?: boolean; defaultRole?: Role }) => ({
      method: "patch",
      path: "/identity/sso",
      body: v,
    }),
    { success: () => "SSO updated", error: "Couldn't change SSO" },
  );
}
export function useDomain() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.identity,
    IdentitySettings,
    (v: { action: "add" | "verify" | "remove"; domain: string }) =>
      v.action === "add"
        ? { method: "post", path: "/identity/domains", body: { domain: v.domain } }
        : v.action === "verify"
          ? { method: "post", path: `/identity/domains/${encodeURIComponent(v.domain)}/verify` }
          : { method: "delete", path: `/identity/domains/${encodeURIComponent(v.domain)}` },
    {
      success: (v) =>
        v.action === "add"
          ? `${v.domain} added`
          : v.action === "verify"
            ? `${v.domain} verified`
            : `${v.domain} removed`,
      error: "Domain change failed",
    },
  );
}
export function useScimToken() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.identity,
    IdentitySettings,
    (_v: undefined) => ({ method: "post", path: "/identity/scim/token" }),
    {
      error: "Couldn't issue a token",
    },
  );
}
export function useScimMappings() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.identity,
    IdentitySettings,
    (v: { mappings: { group: string; roles: Role[] }[] }) => ({
      method: "put",
      path: "/identity/scim/mappings",
      body: v,
    }),
    { success: () => "Group mappings saved and applied", error: "Couldn't save the mappings" },
  );
}
export function useScimSync() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.identity,
    IdentitySettings,
    (_v: undefined) => ({ method: "post", path: "/identity/scim/sync" }),
    {
      success: () => "Sync complete",
      error: "Couldn't sync",
    },
  );
}

/* Agents and policies */
export function useUpdateAgent() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.agentGov,
    AgentGovernance,
    (
      v: { id: string } & Partial<
        Pick<AgentGovernance["agents"][number], "status" | "autonomy" | "dataAccess" | "budgetUsd">
      >,
    ) => {
      const { id, ...body } = v;
      return { method: "patch", path: `/agents/${id}`, body };
    },
    { success: (v) => `${v.id} updated`, error: "Couldn't change the agent" },
  );
}
export function useUpdatePolicy() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.agentGov,
    AgentGovernance,
    (v: { id: string; enabled?: boolean; enforcement?: "block" | "approve" | "log" }) => {
      const { id, ...body } = v;
      return { method: "patch", path: `/policies/${id}`, body };
    },
    { success: () => "Guardrail updated", error: "Couldn't change the guardrail" },
  );
}
export function useKillSwitch() {
  const { keys } = useTenant();
  return useSecWrite(
    keys.agentGov,
    AgentGovernance,
    (v: { engaged: boolean; reason: string }) => ({ method: "post", path: "/agents/kill-switch", body: v }),
    {
      success: (v) => (v.engaged ? "All agents stopped" : "Agents released"),
      error: "Kill switch failed",
    },
  );
}
