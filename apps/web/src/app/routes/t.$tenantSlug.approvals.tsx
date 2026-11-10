import { createFileRoute } from "@tanstack/react-router";
import { ApprovalsPage } from "@/features/approvals";

export const Route = createFileRoute("/t/$tenantSlug/approvals")({ component: ApprovalsPage });
