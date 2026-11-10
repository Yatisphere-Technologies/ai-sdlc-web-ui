import { type RiskTier, STAGES, type WorkItem } from "@throughline/contracts";
import { Badge, cn, StatusDot } from "@throughline/ui";

const RISK_TONE: Record<RiskTier, "neutral" | "ok" | "gate" | "risk"> = {
  0: "neutral",
  1: "ok",
  2: "gate",
  3: "risk",
};

export function RiskBadge({ risk, compact = false }: { risk: RiskTier; compact?: boolean }) {
  return (
    <Badge tone={RISK_TONE[risk]} mono>
      {compact ? `T${risk}` : `Tier ${risk}`}
    </Badge>
  );
}

/** Eight segments, one per stage: done, current (agent or waiting on a person), not reached. */
export function StageBar({ item }: { item: WorkItem }) {
  const at = STAGES.indexOf(item.stage);
  const waiting = item.waitingOn.kind === "human";
  return (
    <div className="grid grid-cols-9 gap-1" aria-hidden>
      {STAGES.map((s, i) => (
        <span
          key={s}
          className={cn(
            "h-1.5 rounded-full",
            i < at && "bg-agent",
            i === at && (waiting ? "bg-gate" : "bg-agent-fg"),
            i > at && "bg-line",
          )}
        />
      ))}
    </div>
  );
}

export function WaitingOn({ item }: { item: WorkItem }) {
  const human = item.waitingOn.kind === "human";
  return (
    <span className={cn("text-body-sm flex items-center gap-2", human ? "text-gate-fg" : "text-agent-fg")}>
      <StatusDot tone={human ? "gate" : "agent"} live={!human} />
      {item.waitingOn.label}
    </span>
  );
}
