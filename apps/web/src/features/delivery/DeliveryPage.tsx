import { useNavigate } from "@tanstack/react-router";
import { Eyebrow, PageHeader, SegmentedControl } from "@throughline/ui";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { useTenant } from "@/tenancy";
import { BuildView } from "./BuildView";
import { ReleaseView } from "./ReleaseView";
import { VerifyView } from "./VerifyView";

export type DeliveryTab = "build" | "verify" | "release";
export const DELIVERY_TABS: DeliveryTab[] = ["build", "verify", "release"];

const HEAD: Record<DeliveryTab, { title: string; accent: string }> = {
  build: { title: "Agents build in parallel.", accent: "Every line traced to a requirement." },
  verify: { title: "Trust,", accent: "with receipts. Two keys at G3." },
  release: { title: "Ship in small steps.", accent: "Let health decide at G4." },
};

/** One change from code to production: build lanes, the G3 evidence locker, the G4 rollout. */
export function DeliveryPage({ tab = "build", wi }: { tab?: DeliveryTab; wi?: string }) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Delivery · build → verify → release · {tenant.name}</Eyebrow>}
        title={HEAD[tab].title}
        accent={HEAD[tab].accent}
      />
      <SegmentedControl
        label="Delivery stage"
        className="self-start"
        value={tab}
        onValueChange={(t) =>
          navigate({
            to: "/t/$tenantSlug/delivery",
            params: { tenantSlug: tenant.slug },
            search: t === "build" ? {} : { tab: t },
          })
        }
        options={[
          { value: "build", label: "Build" },
          { value: "verify", label: "Verify · G3" },
          { value: "release", label: "Release · G4" },
        ]}
      />
      <QueryBoundary>
        {tab === "build" ? <BuildView key={wi ?? "all"} wi={wi} /> : null}
        {tab === "verify" ? <VerifyView key={wi ?? "all"} wi={wi} /> : null}
        {tab === "release" ? <ReleaseView key={wi ?? "all"} wi={wi} /> : null}
      </QueryBoundary>
    </>
  );
}
