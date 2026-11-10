import type { Kpi } from "@throughline/contracts";
import { Card, cn, Sparkline } from "@throughline/ui";

export function KpiTiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-5">
      {kpis.map((k, i) => (
        <Card
          key={k.id}
          interactive
          padding="sm"
          className="animate-rise flex flex-col gap-2"
          style={{ animationDelay: `${0.5 + i * 0.05}s` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-sm text-muted">{k.label}</span>
            <span className={cn("text-micro font-mono", k.trend === "good" ? "text-ok" : "text-risk-fg")}>
              {k.delta}
            </span>
          </div>
          <span className="font-display text-metric-lg text-strong">{k.value}</span>
          <Sparkline values={k.series} tone={k.trend === "good" ? "agent" : "gate"} />
          <span className="text-micro text-faint font-mono uppercase">{k.target}</span>
        </Card>
      ))}
    </div>
  );
}
