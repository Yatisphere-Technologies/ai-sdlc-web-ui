import { STAGE_LABEL, type StageSummary } from "@throughline/contracts";
import { Card, CardHeader, CardTitle, cn, EmptyState, Progress } from "@throughline/ui";

const noteTone = { working: "text-muted", waiting: "text-gate-fg", done: "text-ok" } as const;
const barTone = { working: "agent", waiting: "gate", done: "ok" } as const;

export function StageDetail({ stage }: { stage: StageSummary }) {
  return (
    <Card className="animate-rise flex flex-col gap-3" style={{ animationDelay: "0.2s" }}>
      <CardHeader className="mb-0">
        <CardTitle>{STAGE_LABEL[stage.stage]}</CardTitle>
        <span className="text-micro text-muted font-mono">
          {stage.count} {stage.unit}
        </span>
      </CardHeader>
      <p className="text-body-sm text-subtle">{stage.blurb}</p>
      {stage.items.length === 0 ? (
        <EmptyState title="Nothing here right now" className="py-8" />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {stage.items.map((it) => (
            <li
              key={it.key}
              className="hover-lift border-line bg-surface-raised flex flex-col gap-2 rounded-lg border p-3.5"
            >
              <div className="flex justify-between gap-3">
                <span className="text-body font-semibold">{it.title}</span>
                <span className="text-micro text-muted shrink-0 font-mono">{it.key}</span>
              </div>
              <Progress
                value={it.progress}
                tone={barTone[it.state]}
                working={it.state === "working"}
                label={`${it.title} progress`}
              />
              <span className={cn("text-caption", noteTone[it.state])}>{it.note}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
