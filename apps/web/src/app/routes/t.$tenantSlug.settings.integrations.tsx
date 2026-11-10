import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings/integrations")({ component: IntegrationsPage });
