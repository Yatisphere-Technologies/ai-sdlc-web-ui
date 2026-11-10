import { createFileRoute } from "@tanstack/react-router";
import { SecurityPage } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings/security")({ component: SecurityPage });
