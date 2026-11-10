import { Insights, type InsightsPeriod } from "@throughline/contracts";
import {
  Card,
  CardHeader,
  CardTitle,
  cn,
  Eyebrow,
  GateMark,
  PageHeader,
  Progress,
  SegmentedControl,
  Skeleton,
} from "@throughline/ui";
import { Suspense, useState } from "react";
import { useTenantData } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

const TONE = { ok: "text-ok", gate: "text-gate", agent: "text-agent", risk: "text-risk-fg" } as const;

function Dashboard({ period }: { period: InsightsPeriod }) {
  const { keys } = useTenant();
  const d = useTenantData(keys.insights(period), `/insights?period=${period}`, Insights);
  const max = Math.max(...d.throughput.map((w) => w.agent + w.human), 1);
  const agentShare = Math.round(
    (d.throughput.reduce((a, w) => a + w.agent, 0) /
      d.throughput.reduce((a, w) => a + w.agent + w.human, 0)) *
      100,
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {d.dora.map((m, i) => (
          <Card
            key={m.label}
            interactive
            className="animate-rise flex flex-col gap-2.5"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <span className="text-body-sm text-muted">{m.label}</span>
            <span className="flex items-baseline gap-2.5">
              <span className="font-display text-metric-lg text-strong">{m.value}</span>
              <span className="text-micro text-ok font-mono">{m.delta}</span>
            </span>
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
              <span className="text-faint text-nano font-mono">BEFORE</span>
              <Progress value={m.before} tone="neutral" size="md" label={`${m.label} before`} />
              <span className="text-agent text-nano font-mono">NOW</span>
              <Progress value={m.now} tone="agent" size="md" label={`${m.label} now`} />
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="flex flex-col gap-4">
          <CardHeader className="mb-0 flex-wrap">
            <CardTitle>Merged changes per week</CardTitle>
            <span className="text-caption text-muted flex gap-3">
              <span className="flex items-center gap-1.5">
                <span className="bg-agent size-2.5 rounded-xs" />
                Agent-written, human-approved
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-ion size-2.5 rounded-xs" />
                Human-written
              </span>
            </span>
          </CardHeader>
          <div
            className="border-line flex h-56 items-end gap-2 border-b"
            role="img"
            aria-label={`Weekly merged changes; agents wrote ${agentShare}%`}
          >
            {d.throughput.map((w) => (
              <div key={w.week} className="flex h-full flex-1 flex-col justify-end gap-0.5">
                <div
                  className="bg-agent ease-out-soft rounded-t-sm transition-[height] duration-700"
                  style={{ height: `${(w.agent / max) * 100}%` }}
                />
                <div
                  className="bg-ion ease-out-soft transition-[height] duration-700"
                  style={{ height: `${(w.human / max) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <span className="text-faint text-micro font-mono">LAST 12 WEEKS · AGENT SHARE {agentShare}%</span>
        </Card>
        <Card className="flex flex-col gap-3.5">
          <CardHeader className="mb-0">
            <CardTitle>AI spend</CardTitle>
            <span className="text-caption font-mono">
              ${(d.spend.used / 1000).toFixed(1)}k{" "}
              <span className="text-muted">/ ${(d.spend.budget / 1000).toFixed(0)}k</span>
            </span>
          </CardHeader>
          <Progress
            value={(d.spend.used / d.spend.budget) * 100}
            size="lg"
            tone={d.spend.used / d.spend.budget > 0.85 ? "gate" : "agent"}
            label="Budget used"
          />
          {d.spend.byAgent.map((a) => (
            <div key={a.label} className="grid grid-cols-[9rem_minmax(0,1fr)_2.5rem] items-center gap-2.5">
              <span className="text-caption text-subtle">{a.label}</span>
              <Progress value={a.pct * 2} tone="agent" size="md" label={a.label} />
              <span className="text-micro text-muted text-right font-mono">{a.pct}%</span>
            </div>
          ))}
          <span className="border-line text-caption text-muted border-t pt-3">
            Cost per merged change{" "}
            <span className="text-foreground font-semibold">${d.spend.costPerChange.toFixed(2)}</span>
          </span>
        </Card>
      </div>
      <Card className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {d.governance.map((g) => (
          <div key={g.label} className="flex items-center gap-3.5">
            <GateMark state={g.tone === "ok" ? "approved" : "open"} size="lg" />
            <span className="flex flex-col">
              <span className={cn("font-display text-metric", TONE[g.tone])}>{g.value}</span>
              <span className="text-caption text-muted">{g.label}</span>
            </span>
          </div>
        ))}
      </Card>
    </>
  );
}

export function InsightsPage() {
  const { tenant } = useTenant();
  const [period, setPeriod] = useState<InsightsPeriod>("30d");
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Insights · value and governance · {tenant.name}</Eyebrow>}
        title="Is AI paying off?"
        accent="Here's the proof."
        actions={
          <SegmentedControl<InsightsPeriod>
            label="Period"
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: "30d", label: "30 days" },
              { value: "90d", label: "90 days" },
              { value: "6m", label: "6 months" },
            ]}
          />
        }
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Dashboard period={period} />
      </Suspense>
    </>
  );
}
