import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceVoice } from "@/features/assistant";
import { NewBrdChat } from "@/features/brd-studio";
import { loadTenantRoute, TenantProvider } from "@/tenancy";

/** A new BRD starts as a full-screen conversation with the BA agent. */
export const Route = createFileRoute("/t/$tenantSlug_/brd/new")({
  beforeLoad: ({ context, params, location }) =>
    loadTenantRoute(context.queryClient, params.tenantSlug, location.href),
  component: NewBrdRoute,
});

function NewBrdRoute() {
  const { tenant, membership } = Route.useRouteContext();
  return (
    <TenantProvider key={tenant.id} tenant={tenant} membership={membership}>
      <WorkspaceVoice>
        <NewBrdChat />
      </WorkspaceVoice>
    </TenantProvider>
  );
}
