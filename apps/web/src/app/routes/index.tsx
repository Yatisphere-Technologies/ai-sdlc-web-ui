import { createFileRoute, redirect } from "@tanstack/react-router";
import { config } from "@/app/config";
import { LandingPage } from "@/features/marketing";
import { tenantSlugFromHost } from "@/tenancy";

/** Public front door. acme.throughline.app skips it and goes straight to the Acme workspace. */
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const slug = tenantSlugFromHost(window.location.hostname, config.tenantBaseDomain);
    if (slug) throw redirect({ to: "/t/$tenantSlug", params: { tenantSlug: slug } });
  },
  component: LandingPage,
});
