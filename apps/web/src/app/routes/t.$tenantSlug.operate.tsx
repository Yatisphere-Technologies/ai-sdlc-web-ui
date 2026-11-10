import { createFileRoute } from "@tanstack/react-router";
import { OperatePage } from "@/features/operate";

export const Route = createFileRoute("/t/$tenantSlug/operate")({ component: OperatePage });
