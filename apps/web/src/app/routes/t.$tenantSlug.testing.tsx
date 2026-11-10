import { createFileRoute } from "@tanstack/react-router";
import { TestingPage } from "@/features/testing";

type TestingSearch = { plan?: string };

export const Route = createFileRoute("/t/$tenantSlug/testing")({
  validateSearch: (search: Record<string, unknown>): TestingSearch => ({
    plan: typeof search.plan === "string" ? search.plan : undefined,
  }),
  component: TestingRoute,
});

function TestingRoute() {
  const { plan } = Route.useSearch();
  return <TestingPage selected={plan} />;
}
