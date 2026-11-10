import { createFileRoute } from "@tanstack/react-router";
import { AuditLogPage } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings/audit")({ component: AuditLogPage });
