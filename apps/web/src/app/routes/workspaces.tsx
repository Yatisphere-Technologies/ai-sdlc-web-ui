import { createFileRoute, redirect } from "@tanstack/react-router";
import { requireSession } from "@/auth/session";
import { WorkspaceChooser } from "@/features/workspaces";

export const Route = createFileRoute("/workspaces")({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient, location.href);
    const only = session.tenants.length === 1 ? session.tenants[0] : undefined;
    if (only) throw redirect({ to: "/t/$tenantSlug", params: { tenantSlug: only.slug } });
  },
  component: WorkspaceChooser,
});
