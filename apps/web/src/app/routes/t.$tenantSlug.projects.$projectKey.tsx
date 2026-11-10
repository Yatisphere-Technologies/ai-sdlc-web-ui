import { createFileRoute } from "@tanstack/react-router";
import { ProjectPage, type ProjectTab } from "@/features/projects";

const TABS: ProjectTab[] = ["overview", "plan", "artifacts", "trace", "work"];
type ProjectSearch = { tab?: ProjectTab; item?: string };

export const Route = createFileRoute("/t/$tenantSlug/projects/$projectKey")({
  validateSearch: (search: Record<string, unknown>): ProjectSearch => ({
    tab: TABS.includes(search.tab as ProjectTab) ? (search.tab as ProjectTab) : undefined,
    item: typeof search.item === "string" ? search.item : undefined,
  }),
  component: ProjectRoute,
});

function ProjectRoute() {
  const { projectKey } = Route.useParams();
  const { tab, item } = Route.useSearch();
  return <ProjectPage projectKey={projectKey} tab={tab ?? "overview"} item={item} />;
}
