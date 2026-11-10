import type { AgentRun } from "@throughline/contracts";
import { Card, CardHeader, CardTitle, cn, Progress, StatusDot } from "@throughline/ui";

export function AgentFleet({ agents }: { agents: AgentRun[] }) {
  const running = agents.filter((a) => a.running).length;
  return (
    <Card className="animate-rise flex flex-col gap-2.5" style={{ animationDelay: "0.3s" }}>
      <CardHeader className="mb-1">
        <CardTitle>Agent fleet</CardTitle>
        <span className="text-micro text-agent-fg flex items-center gap-2 font-mono">
          <StatusDot tone="agent" live /> {running} RUNNING
        </span>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {agents.map((a) => (
          <li
            key={a.id}
            className="bg-surface-raised grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 rounded-md p-2.5"
          >
            <span
              className={cn(
                "text-micro flex size-9 items-center justify-center rounded-sm font-mono",
                a.running ? "bg-agent-soft text-agent" : "bg-line text-muted",
              )}
            >
              {a.code}
            </span>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-body-sm font-semibold whitespace-nowrap">{a.name}</span>
                <span className="text-caption text-muted truncate">{a.task}</span>
              </div>
              <Progress value={a.progress} working={a.running} tone="neutral" label={`${a.name} progress`} />
            </div>
            <span className="text-micro text-muted font-mono">{a.model}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
