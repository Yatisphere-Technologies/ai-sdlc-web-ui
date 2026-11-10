import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/t/$tenantSlug/settings/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/t/$tenantSlug/settings/integrations", params });
  },
});
