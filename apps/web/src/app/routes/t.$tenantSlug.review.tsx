import { createFileRoute } from "@tanstack/react-router";
import { ReviewPage } from "@/features/review";

type ReviewSearch = { wi?: string };

export const Route = createFileRoute("/t/$tenantSlug/review")({
  validateSearch: (search: Record<string, unknown>): ReviewSearch => ({
    wi: typeof search.wi === "string" ? search.wi : undefined,
  }),
  component: ReviewRoute,
});

function ReviewRoute() {
  const { wi } = Route.useSearch();
  return <ReviewPage wi={wi} />;
}
