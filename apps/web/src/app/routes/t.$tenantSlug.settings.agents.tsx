import { createFileRoute } from "@tanstack/react-router";
import { AgentsPage } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings/agents")({ component: AgentsPage });
