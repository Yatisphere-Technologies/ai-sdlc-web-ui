import { type Release, ReleaseList } from "@throughline/contracts";
import { Badge, Button, Card, cn, EmptyState, Progress, Sparkline, StatusDot } from "@throughline/ui";
import { CircleCheck, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { ItemPicker } from "./ItemPicker";

/** Canary and baseline share one scale so the two lines are comparable. */
const domainOf = (h: Release["health"][number]) => {
  const all = [...h.series, ...h.baseSeries];
  return [Math.min(...all), Math.max(...all)] as const;
};

function Rollout({ release }: { release: Release }) {
  const { keys, can } = useTenant();
  const op = useTenantWrite(keys.releases, ReleaseList, (v: { op: "promote" | "rollback" }) => ({
    method: "post",
    path: `/releases/${release.id}/${v.op}`,
  }));
  const step = release.steps[release.currentStep];
  const next = release.steps[release.currentStep + 1];
  const pct = release.status === "rolled-back" ? 0 : (step?.percent ?? 0);
  const allowed = can("gate.approve.g4");

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {release.provenance.map((p) => (
          <Badge key={p} tone="ok" mono>
            <ShieldCheck className="size-3" aria-hidden /> {p}
          </Badge>
        ))}
      </div>
      <Card padding="lg" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <span
              className={cn(
                "font-display text-display-xl",
                release.status === "rolled-back" ? "text-risk" : "text-agent",
              )}
            >
              {pct}%
            </span>
            <span className="text-body text-muted">
              {release.status === "rolled-back"
                ? "Rolled back · everyone on the previous version"
                : `of customers on ${release.name}`}
            </span>
          </div>
          {allowed ? (
            <div className="flex flex-wrap gap-2.5">
              {release.status === "rolling" && next ? (
                <Button
                  variant="gate"
                  size="lg"
                  disabled={op.isPending}
                  onClick={() => op.mutate({ op: "promote" })}
                >
                  Promote to {next.percent}%
                </Button>
              ) : null}
              {release.status === "complete" ? (
                <span className="animate-pop text-ok flex items-center gap-2 font-semibold">
                  <CircleCheck className="size-5" aria-hidden /> Fully rolled out
                </span>
              ) : null}
              {release.status !== "rolled-back" ? (
                <Button
                  variant="danger"
                  size="lg"
                  disabled={op.isPending}
                  onClick={() => op.mutate({ op: "rollback" })}
                >
                  Roll back
                </Button>
              ) : null}
            </div>
          ) : (
            <span className="text-caption text-muted">A release manager promotes at G4.</span>
          )}
        </div>
        <Progress
          value={pct}
          size="lg"
          tone={release.status === "rolled-back" ? "risk" : "agent"}
          label="Rollout"
        />
        <ol className="grid grid-cols-5 gap-2.5">
          {release.steps.map((s, i) => {
            const state =
              release.status === "rolled-back"
                ? "idle"
                : i < release.currentStep
                  ? "done"
                  : i === release.currentStep
                    ? "live"
                    : "idle";
            return (
              <li
                key={s.percent}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-3",
                  state === "live" ? "border-agent bg-agent-wash" : "border-line bg-surface-raised",
                )}
              >
                <span
                  className={cn(
                    "font-display text-heading-md",
                    state === "done" ? "text-ok" : state === "live" ? "text-agent" : "text-ghost",
                  )}
                >
                  {s.percent}%
                </span>
                <span className="text-caption text-muted">{s.audience}</span>
                <span
                  className={cn(
                    "text-nano font-mono",
                    state === "done" ? "text-ok" : state === "live" ? "text-agent" : "text-ghost",
                  )}
                >
                  {state === "done" ? "DONE" : state === "live" ? "LIVE NOW" : "NEXT"}
                </span>
              </li>
            );
          })}
        </ol>
        <ErrorNote error={op.error} />
      </Card>
      <div className="grid gap-5 md:grid-cols-3">
        {release.health.map((h) => (
          <Card key={h.metric} interactive className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-body font-semibold">{h.metric}</span>
              <Badge tone="ok">Healthy</Badge>
            </div>
            <div className="flex gap-6">
              <span className="flex flex-col">
                <span className="text-agent text-nano font-mono">CANARY</span>
                <span className="font-display text-metric">{h.canary}</span>
              </span>
              <span className="flex flex-col">
                <span className="text-muted text-nano font-mono">BASELINE</span>
                <span className="font-display text-metric text-muted">{h.baseline}</span>
              </span>
            </div>
            <div className="relative h-10">
              {h.baseSeries.length ? (
                <Sparkline
                  values={h.baseSeries}
                  tone="neutral"
                  domain={domainOf(h)}
                  className="absolute inset-0"
                />
              ) : null}
              <Sparkline values={h.series} tone="agent" domain={domainOf(h)} className="absolute inset-0" />
            </div>
            <span className="text-faint text-micro font-mono uppercase">Red line · {h.redLine}</span>
          </Card>
        ))}
      </div>
      <Card tone="sunken" padding="sm" className="text-body-sm text-subtle flex items-center gap-3">
        <StatusDot live size="md" /> release-agent watches every step. It rolls back by itself if a red line
        is crossed for 5 minutes, then pages on-call with the evidence.
      </Card>
    </>
  );
}

/** Progressive rollouts at G4. `wi` preselects the release for a work item. */
export function ReleaseView({ wi }: { wi?: string }) {
  const { keys } = useTenant();
  const { items } = useTenantData(keys.releases, "/releases", ReleaseList);
  const [id, setId] = useState(items.find((r) => r.workItemKey === wi)?.id ?? items[0]?.id ?? "");
  const release = items.find((r) => r.id === id) ?? items[0];
  if (!release) return <EmptyState title="No releases in progress" />;
  return (
    <>
      <ItemPicker
        label="Release"
        items={items.map((r) => ({ id: r.id, label: `${r.name} · ${r.service} · ${r.workItemKey}` }))}
        value={release.id}
        onChange={setId}
      />
      <Rollout key={release.id} release={release} />
    </>
  );
}
