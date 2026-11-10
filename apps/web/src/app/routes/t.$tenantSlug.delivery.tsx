import { createFileRoute } from "@tanstack/react-router";
import { DELIVERY_TABS, DeliveryPage, type DeliveryTab } from "@/features/delivery";

type DeliverySearch = { tab?: DeliveryTab; wi?: string };

export const Route = createFileRoute("/t/$tenantSlug/delivery")({
  validateSearch: (search: Record<string, unknown>): DeliverySearch => ({
    tab: DELIVERY_TABS.includes(search.tab as DeliveryTab) ? (search.tab as DeliveryTab) : undefined,
    wi: typeof search.wi === "string" ? search.wi : undefined,
  }),
  component: DeliveryRoute,
});

function DeliveryRoute() {
  const { tab, wi } = Route.useSearch();
  return <DeliveryPage tab={tab} wi={wi} />;
}
