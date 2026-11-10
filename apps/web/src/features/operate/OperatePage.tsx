import { type Incident, IncidentList } from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  cn,
  EmptyState,
  Eyebrow,
  PageHeader,
  StatusDot,
} from "@throughline/ui";
import { CircleCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { ErrorNote } from "@/components/data/ErrorNote";
import { PickList } from "@/components/data/PickList";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { useTenant } from "@/tenancy";

const DOT = { change: "bg-ion", alert: "bg-risk", agent: "bg-agent", human: "bg-gate", ok: "bg-ok" } as const;

function IncidentDetail({ incident }: { incident: Incident }) {
  const { keys, can } = useTenant();
  const approve = useTenantWrite(keys.incidents, IncidentList, (id: string) => ({
    method: "post",
    path: `/incidents/${id}/approve-fix`,
  }));
  const resolved = incident.status === "resolved";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Card tone={resolved ? "ok" : "risk"} className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <StatusDot tone={resolved ? "ok" : "risk"} live={!resolved} size="md" />
          <div className="flex flex-col gap-1">
            <span className={cn("text-micro font-mono", resolved ? "text-ok" : "text-risk-fg")}>
              {incident.severity.toUpperCase()} ·{" "}
              {resolved ? "RESOLVED" : `OPEN · ON-CALL ${incident.onCall.toUpperCase()}`}
            </span>
            <span className="font-display text-heading-md text-strong">{incident.title}</span>
          </div>
        </div>
        <span className="text-micro text-subtle flex gap-5 font-mono">
          <span>STARTED {incident.startedAt}</span>
          <span>DETECTED IN {incident.detectedIn}</span>
        </span>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="flex flex-col gap-1">
          <CardTitle className="mb-3">Timeline</CardTitle>
          <ol>
            {incident.timeline.map((t, i) => (
              <li
                key={`${t.time}-${t.text}`}
                className="animate-rise grid grid-cols-[3rem_0.75rem_minmax(0,1fr)] gap-2.5"
                style={{ animationDelay: `${i * 0.08}s` }}
              >
                <span className="text-micro text-muted pt-0.5 font-mono">{t.time}</span>
                <span className="flex flex-col items-center">
                  <span className={cn("mt-1 size-2.5 rounded-full", DOT[t.kind])} />
                  <span className="bg-line w-px flex-1" />
                </span>
                <span className="text-body-sm text-code pb-4">{t.text}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card className="flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle>What the SRE agent thinks happened</CardTitle>
            <span className="text-agent-fg text-micro font-mono">TRACES · LOGS · DEPLOYS</span>
          </div>
          {incident.hypotheses.map((h, i) => (
            <div
              key={h.title}
              className={cn(
                "flex flex-col gap-2.5 rounded-lg border p-4",
                i === 0 ? "border-agent-line bg-surface-raised" : "border-line bg-surface-raised",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-body font-semibold">{h.title}</span>
                <span className={cn("font-display text-metric", i === 0 ? "text-agent" : "text-muted")}>
                  {h.confidence}%
                </span>
              </div>
              <span className="bg-line h-1.5 overflow-hidden rounded-full">
                <span
                  className={cn(
                    "block h-full rounded-full transition-[width] duration-700",
                    i === 0 ? "bg-agent" : "bg-ion",
                  )}
                  style={{ width: `${h.confidence}%` }}
                />
              </span>
              <span className="text-caption text-muted">{h.evidence}</span>
            </div>
          ))}
          <Card
            tone={resolved ? "ok" : "gate"}
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="flex flex-col gap-0.5">
              <span className={cn("text-micro font-mono", resolved ? "text-ok" : "text-gate")}>
                {resolved ? "APPLIED" : "RECOMMENDED ACTION · NEEDS ON-CALL"}
              </span>
              <span className="text-body font-semibold">{incident.action}</span>
            </span>
            {resolved ? (
              <CircleCheck className="text-ok size-6" aria-label="Applied" />
            ) : can("incident.approve") ? (
              <Button variant="gate" disabled={approve.isPending} onClick={() => approve.mutate(incident.id)}>
                Approve as on-call
              </Button>
            ) : (
              <span className="text-caption text-muted">On-call approves</span>
            )}
          </Card>
          <ErrorNote error={approve.error} />
        </Card>
      </div>
      <Card tone={resolved ? "agent" : "default"} className="flex flex-wrap items-center gap-5">
        <RefreshCw
          className={cn("text-agent size-10", resolved && "animate-spin")}
          style={{ animationDuration: "6s" }}
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Eyebrow className="text-agent-fg">Learn · learn-agent proposes</Eyebrow>
          <span className="font-display text-heading-md text-strong">
            {resolved ? incident.learning.rule : "Waiting for the incident to close"}
          </span>
          <span className="text-body-sm text-subtle">
            {resolved
              ? incident.learning.detail
              : "Once resolved, the cause becomes a test, a team rule and a review check, so it can't recur."}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {incident.learning.changes.map((c) => (
            <Badge key={c} tone={resolved ? "ok" : "neutral"} mono>
              {c}
            </Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Operate() {
  const { keys } = useTenant();
  const { items } = useTenantData(keys.incidents, "/incidents", IncidentList);
  const [id, setId] = useState(items[0]?.id ?? "");
  const incident = items.find((i) => i.id === id) ?? items[0];
  if (!incident) return <EmptyState title="All quiet. No incidents." />;
  return (
    <div className="grid gap-5 2xl:grid-cols-[16rem_minmax(0,1fr)]">
      <PickList
        label="Incidents"
        items={items}
        selectedId={incident.id}
        onSelect={setId}
        render={(i) => (
          <>
            <span className="flex items-center justify-between">
              <span className="text-faint text-micro font-mono">{i.id}</span>
              <Badge tone={i.status === "resolved" ? "ok" : "risk"} mono>
                {i.status}
              </Badge>
            </span>
            <span className="text-body font-semibold">{i.title}</span>
            <span className="text-caption text-muted">{i.service}</span>
          </>
        )}
      />
      <IncidentDetail incident={incident} />
    </div>
  );
}

export function OperatePage() {
  const { tenant } = useTenant();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Operate → Learn · {tenant.name}</Eyebrow>}
        title="Find it fast. Fix it once."
        accent="Never again."
      />
      <QueryBoundary>
        <Operate />
      </QueryBoundary>
    </>
  );
}
