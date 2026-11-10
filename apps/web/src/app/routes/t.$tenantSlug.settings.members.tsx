import { createFileRoute } from "@tanstack/react-router";
import { MembersPage } from "@/features/settings";

export const Route = createFileRoute("/t/$tenantSlug/settings/members")({ component: MembersPage });
