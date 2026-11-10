import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@/features/assistant";

type AskSearch = { c?: string };

export const Route = createFileRoute("/t/$tenantSlug/ask")({
  validateSearch: (search: Record<string, unknown>): AskSearch => ({
    c: typeof search.c === "string" ? search.c : undefined,
  }),
  component: AskRoute,
});

function AskRoute() {
  const { c } = Route.useSearch();
  return <AssistantPage conversation={c} />;
}
