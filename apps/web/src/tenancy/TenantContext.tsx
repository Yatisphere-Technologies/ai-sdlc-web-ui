import { useQueryClient } from "@tanstack/react-query";
import type { Action, Membership, Tenant } from "@throughline/contracts";
import { createContext, type ReactNode, use, useEffect, useMemo } from "react";
import { createTenantApi, type TenantApi } from "@/api/http";
import { queryKeys, type TenantQueryKeys } from "@/api/queryKeys";

type TenantContextValue = {
  tenant: Tenant;
  membership: Membership;
  /** API client that is already scoped to this tenant */
  api: TenantApi;
  /** Query keys that are already scoped to this tenant */
  keys: TenantQueryKeys;
  can: (action: Action) => boolean;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  tenant,
  membership,
  children,
}: {
  tenant: Tenant;
  membership: Membership;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      membership,
      api: createTenantApi(tenant.id),
      keys: queryKeys.tenant(tenant.id),
      can: (action) => membership.allowedActions.includes(action),
    }),
    [tenant, membership],
  );

  // When the user leaves a tenant, drop its cached data so nothing from it lingers in memory.
  useEffect(() => {
    const keys = queryKeys.tenant(tenant.id);
    return () => {
      queryClient.removeQueries({ queryKey: keys.all });
    };
  }, [tenant.id, queryClient]);

  return <TenantContext value={value}>{children}</TenantContext>;
}

export function useTenant() {
  const ctx = use(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside a tenant route (/t/$tenantSlug)");
  return ctx;
}

/** Render children only if the current user may perform the action in this tenant. */
export function Can({
  action,
  children,
  fallback = null,
}: {
  action: Action;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useTenant().can(action) ? children : fallback;
}
