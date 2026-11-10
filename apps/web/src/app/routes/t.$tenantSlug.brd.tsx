import { createFileRoute } from "@tanstack/react-router";
import { BrdPage, type BrdView } from "@/features/brd";

type BrdSearch = { view?: BrdView; wi?: string };

export const Route = createFileRoute("/t/$tenantSlug/brd")({
  validateSearch: (search: Record<string, unknown>): BrdSearch => ({
    view: search.view === "specs" ? "specs" : undefined,
    wi: typeof search.wi === "string" ? search.wi : undefined,
  }),
  component: BrdRoute,
});

function BrdRoute() {
  const { view, wi } = Route.useSearch();
  return <BrdPage view={view} wi={wi} />;
}
