import { createFileRoute } from "@tanstack/react-router";
import { SsoPage } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings/sso")({ component: SsoPage });
