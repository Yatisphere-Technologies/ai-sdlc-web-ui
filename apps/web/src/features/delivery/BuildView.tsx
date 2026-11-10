import { BuildBoard } from "@throughline/contracts";
import { Badge, Card, cn, EmptyState, StatusDot } from "@throughline/ui";
import { useState } from "react";
import { useTenantData } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

const STEPS = ["Plan", "Code", "Test", "Review", "PR"];
const LOG = {
  muted: "text-muted",
  info: "text-foreground",
  warn: "text-gate",
  error: "text-risk-fg",
  ok: "text-ok",
} as const;

/** Agents building in parallel, one lane each. `wi` preselects the lane for a work item. */
export function BuildView({ wi }: { wi?: string }) {
  const { keys } = useTenant();
  const { lanes } = useTenantData(keys.build, "/build", BuildBoard);
  const [laneId, setLaneId] = useState(lanes.find((l) => l.workItemKey === wi)?.id ?? lanes[0]?.id ?? "");
  const lane = lanes.find((l) => l.id === laneId) ?? lanes[0];
  if (!lane) return <EmptyState title="No agents are building right now" />;

  return (
    <>
      <div role="tablist" aria-label="Agents" className="grid gap-3.5 md:grid-cols-3">
        {lanes.map((l) => (
          <button
            key={l.id}
            type="button"
            role="tab"
            aria-selected={l.id === lane.id}
            onClick={() => setLaneId(l.id)}
            className={cn(
              "hover-lift flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-4 text-left",
              l.id === lane.id ? "border-agent bg-agent-wash" : "border-line bg-surface",
            )}
          >
            <span className="flex items-center justify-between">
              <span className="text-body flex items-center gap-2 font-semibold">
                <StatusDot live /> {l.agent}
              </span>
              <span className="text-micro text-muted font-mono">{l.model}</span>
            </span>
            <span className="text-body-sm text-subtle">{l.task}</span>
            <span className="grid grid-cols-5 gap-1">
              {STEPS.map((s, i) => (
                <span key={s} className="flex flex-col gap-1.5">
                  <span
                    className={cn(
                      "h-1 rounded-full",
                      i < l.step ? "bg-agent" : i === l.step ? "bg-working" : "bg-line",
                    )}
                  />
                  <span className={cn("text-nano", i <= l.step ? "text-subtle" : "text-ghost")}>{s}</span>
                </span>
              ))}
            </span>
          </button>
        ))}
      </div>
      <div className="text-micro text-muted flex flex-wrap gap-6 font-mono">
        <span>
          CONTEXT <span className="text-foreground">{lane.context}</span>
        </span>
        <span>
          CACHE HIT <span className="text-ok">{lane.cacheHit}</span>
        </span>
        <span>
          SPEND <span className="text-foreground">${lane.costUsd.toFixed(2)}</span>
        </span>
        <span>
          WORK ITEM <span className="text-foreground">{lane.workItemKey}</span>
        </span>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card tone="sunken" padding="none" className="overflow-hidden">
          <div className="border-line flex items-center justify-between border-b px-4 py-3">
            <span className="flex gap-1.5" aria-hidden>
              <span className="bg-risk size-2.5 rounded-full" />
              <span className="bg-gate size-2.5 rounded-full" />
              <span className="bg-ok size-2.5 rounded-full" />
            </span>
            <span className="text-micro text-muted font-mono">
              {lane.agent} · wt/{lane.branch}
            </span>
          </div>
          <ol key={lane.id} className="text-caption flex flex-col gap-1.5 p-4 font-mono">
            {lane.log.map((line, i) => (
              <li
                key={`${line.t}-${line.text}`}
                className="animate-rise flex gap-3"
                style={{ animationDelay: `${0.1 + i * 0.18}s` }}
              >
                <span className="text-ghost shrink-0">{line.t}</span>
                <span className={LOG[line.level]}>{line.text}</span>
              </li>
            ))}
            <li>
              <span className="text-agent">›</span>{" "}
              <span className="animate-caret bg-agent inline-block h-3.5 w-2 align-middle" />
            </li>
          </ol>
        </Card>
        <Card padding="none" className="flex flex-col overflow-hidden">
          <div className="border-line text-caption flex items-center justify-between border-b px-4 py-3 font-mono">
            <span>{lane.diff.file}</span>
            <span>
              <span className="text-ok">+{lane.diff.added}</span>{" "}
              <span className="text-risk-fg">−{lane.diff.removed}</span>
            </span>
          </div>
          <div className="text-caption overflow-x-auto py-2 font-mono">
            {lane.diff.lines
              .map((line, n) => ({ ...line, n }))
              .map((l) => (
                <div
                  key={l.n}
                  className={cn(
                    "grid grid-cols-[4rem_1.25rem_minmax(0,1fr)] items-center",
                    l.sign === "+" && "bg-diff-add",
                    l.sign === "-" && "bg-diff-del",
                  )}
                >
                  <span className="pl-3">
                    {l.req ? (
                      <Badge tone="agent" className="text-nano px-1.5">
                        {l.req}
                      </Badge>
                    ) : null}
                  </span>
                  <span className={l.sign === "+" ? "text-ok" : "text-risk-fg"}>
                    {l.sign === " " ? "" : l.sign}
                  </span>
                  <span
                    className={cn("py-0.5 whitespace-pre", l.sign === "-" ? "text-risk-fg" : "text-code")}
                  >
                    {l.code}
                  </span>
                </div>
              ))}
          </div>
          <div className="border-line mt-auto flex flex-wrap gap-2 border-t px-4 py-3">
            {lane.requirements.map((r) => (
              <Badge key={r}>{r}</Badge>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
