import { Link } from "@tanstack/react-router";
import type { Stage } from "@throughline/contracts";
import { Button, Eyebrow, PageHeader, Skeleton, StatusDot } from "@throughline/ui";
import { Suspense, useState } from "react";
import { useTenant } from "@/tenancy";
import { AgentFleet } from "./AgentFleet";
import { useControlRoom } from "./api";
import { DecisionQueue } from "./DecisionQueue";
import { KpiTiles } from "./KpiTiles";
import { LifecycleRail } from "./LifecycleRail";
import { StageDetail } from "./StageDetail";

function ControlRoom() {
  const data = useControlRoom();
  const [selected, setSelected] = useState<Stage>("build");
  const stage = data.stages.find((s) => s.stage === selected) ?? data.stages[0];

  return (
    <>
      <LifecycleRail stages={data.stages} selected={selected} onSelect={setSelected} />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(22rem,100%),1fr))] gap-5">
        {stage ? <StageDetail stage={stage} /> : null}
        <AgentFleet agents={data.agents} />
        <DecisionQueue decisions={data.decisions} />
      </div>
      <KpiTiles kpis={data.kpis} />
    </>
  );
}

function ControlRoomSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-5" aria-busy="true" aria-label="Loading control room">
      <Skeleton className="h-64 rounded-2xl" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

export function ControlRoomPage() {
  const { tenant, can } = useTenant();
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <StatusDot tone="agent" size="md" live />
            <Eyebrow>Control room · {tenant.name} · live</Eyebrow>
          </>
        }
        title="Everything in flight,"
        accent="end to end."
        actions={
          can("work.create") ? (
            <Button asChild>
              <Link to="/t/$tenantSlug/brd/new" params={{ tenantSlug: tenant.slug }}>
                New intent
              </Link>
            </Button>
          ) : null
        }
      />
      <Suspense fallback={<ControlRoomSkeleton />}>
        <ControlRoom />
      </Suspense>
    </>
  );
}
