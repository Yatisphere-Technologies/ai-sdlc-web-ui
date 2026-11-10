import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SettingsLayout } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings")({
  component: () => (
    <SettingsLayout>
      <Outlet />
    </SettingsLayout>
  ),
});
