import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/features/insights";

export const Route = createFileRoute("/t/$tenantSlug/insights")({ component: InsightsPage });
