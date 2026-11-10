import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/AppShell";
import { WorkspaceVoice } from "@/features/assistant";
import { loadTenantRoute, TenantProvider } from "@/tenancy";

/**
 * Every signed-in screen lives under /t/$tenantSlug. This route is the tenancy boundary: it resolves
 * the tenant from the session, 404s if the user isn't a member, and provides tenant-scoped API
 * clients and query keys to everything below it.
 */
export const Route = createFileRoute("/t/$tenantSlug")({
  beforeLoad: ({ context, params, location }) =>
    loadTenantRoute(context.queryClient, params.tenantSlug, location.href),
  component: TenantLayout,
});

function TenantLayout() {
  const { tenant, membership } = Route.useRouteContext();
  return (
    <TenantProvider key={tenant.id} tenant={tenant} membership={membership}>
      <WorkspaceVoice>
        <AppShell>
          <Outlet />
        </AppShell>
      </WorkspaceVoice>
    </TenantProvider>
  );
}
