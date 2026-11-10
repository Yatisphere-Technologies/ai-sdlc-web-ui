import { createFileRoute } from "@tanstack/react-router";
import { ArchitecturePage, type ArchitectureView } from "@/features/architecture";

type ArchitectureSearch = { arch?: string; view?: ArchitectureView; wi?: string };

export const Route = createFileRoute("/t/$tenantSlug/architecture")({
  validateSearch: (search: Record<string, unknown>): ArchitectureSearch => ({
    arch: typeof search.arch === "string" ? search.arch : undefined,
    view: search.view === "options" ? "options" : undefined,
    wi: typeof search.wi === "string" ? search.wi : undefined,
  }),
  component: ArchitectureRoute,
});

function ArchitectureRoute() {
  const { arch, view, wi } = Route.useSearch();
  return <ArchitecturePage selected={arch} view={view} wi={wi} />;
}
