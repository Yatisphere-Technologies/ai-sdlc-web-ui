import { createFileRoute } from "@tanstack/react-router";
import { ProgramPage } from "@/features/projects";

export const Route = createFileRoute("/t/$tenantSlug/projects/program/$programKey")({
  component: ProgramRoute,
});

function ProgramRoute() {
  const { programKey } = Route.useParams();
  return <ProgramPage programKey={programKey} />;
}
