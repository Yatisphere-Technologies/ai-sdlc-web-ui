import { GATE_AFTER_STAGE, STAGE_LABEL, type Stage, type StageSummary } from "@throughline/contracts";
import { Card, CardHeader, CardTitle, cn, GateMark, StatusDot } from "@throughline/ui";

const PACKETS = [
  { delay: "0s", tone: "text-agent" },
  { delay: "-3s", tone: "text-agent" },
  { delay: "-6.5s", tone: "text-ion" },
  { delay: "-9s", tone: "text-agent" },
  { delay: "-11.5s", tone: "text-ion" },
];

export function LifecycleRail({
  stages,
  selected,
  onSelect,
}: {
  stages: StageSummary[];
  selected: Stage;
  onSelect: (stage: Stage) => void;
}) {
  const selectedIndex = stages.findIndex((s) => s.stage === selected);
  return (
    <Card padding="lg" className="animate-rise" style={{ animationDelay: "0.1s" }}>
      <CardHeader className="flex-wrap">
        <CardTitle>The lifecycle, live</CardTitle>
        <div className="text-caption text-muted flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <StatusDot tone="agent" size="md" /> Work moving
          </span>
          <span className="flex items-center gap-1.5">
            <GateMark size="sm" /> Human gate
          </span>
          <span>Select a stage to inspect it</span>
        </div>
      </CardHeader>
      <div className="overflow-x-auto pb-1">
        <div className="relative min-w-6xl">
          <div className="absolute inset-x-0 top-14 h-4" aria-hidden>
            <svg className="absolute inset-0 h-4 w-full" aria-hidden>
              <line x1="0" y1="8" x2="100%" y2="8" className="stroke-line" strokeWidth="2" />
              <line x1="0" y1="8" x2="100%" y2="8" className="flow-dash stroke-agent-line" strokeWidth="2" />
            </svg>
            {PACKETS.map((p) => (
              <span key={p.delay} className={cn("packet", p.tone)} style={{ animationDelay: p.delay }} />
            ))}
          </div>
          <ol className="relative grid grid-cols-10 gap-2.5">
            {stages.map((s, i) => {
              const gate = GATE_AFTER_STAGE[s.stage];
              const isSelected = s.stage === selected;
              const reached = i <= selectedIndex;
              return (
                <li key={s.stage} className="flex flex-col items-center gap-3">
                  <div className="flex h-7 items-center gap-2">
                    {gate ? (
                      <>
                        <GateMark />
                        <span className="text-micro text-gate font-mono uppercase">{gate}</span>
                      </>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "bg-background text-micro flex size-9 items-center justify-center rounded-full border-2 font-mono",
                      reached ? "border-agent text-agent" : "border-line-strong text-ghost",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelect(s.stage)}
                    aria-pressed={isSelected}
                    className={cn(
                      "hover-lift flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-3.5 text-left",
                      isSelected ? "border-agent bg-agent-soft" : "border-line bg-surface-raised",
                    )}
                  >
                    <span className={cn("eyebrow", isSelected ? "text-agent-fg" : "text-muted")}>
                      {STAGE_LABEL[s.stage]}
                    </span>
                    <span className="font-display text-metric-lg text-strong">{s.count}</span>
                    <span className="text-caption text-muted">{s.unit}</span>
                    <span
                      className={cn(
                        "text-caption flex items-center gap-2.5 pl-1",
                        s.live ? "text-agent-fg" : "text-muted",
                      )}
                    >
                      <StatusDot tone={s.live ? "agent" : "neutral"} live={s.live} />
                      <span className="truncate">{s.activity}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </Card>
  );
}
