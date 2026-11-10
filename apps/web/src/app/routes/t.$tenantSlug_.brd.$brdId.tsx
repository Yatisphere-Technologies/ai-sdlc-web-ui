import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceVoice } from "@/features/assistant";
import { BrdStudio } from "@/features/brd-studio";
import { loadTenantRoute, TenantProvider } from "@/tenancy";

/**
 * BRD Studio: a full-screen workspace with its own layout (no app shell), still inside the tenancy
 * boundary so every call is tenant-scoped.
 */
type StudioSearch = { view?: "write" | "signoff" | "backlog" };

export const Route = createFileRoute("/t/$tenantSlug_/brd/$brdId")({
  validateSearch: (search: Record<string, unknown>): StudioSearch => ({
    view:
      search.view === "backlog" || search.view === "signoff" || search.view === "write"
        ? search.view
        : undefined,
  }),
  beforeLoad: ({ context, params, location }) =>
    loadTenantRoute(context.queryClient, params.tenantSlug, location.href),
  component: StudioRoute,
});

function StudioRoute() {
  const { tenant, membership } = Route.useRouteContext();
  const { brdId } = Route.useParams();
  const { view } = Route.useSearch();
  return (
    <TenantProvider key={tenant.id} tenant={tenant} membership={membership}>
      <WorkspaceVoice>
        <BrdStudio brdId={brdId} initialView={view} />
      </WorkspaceVoice>
    </TenantProvider>
  );
}
