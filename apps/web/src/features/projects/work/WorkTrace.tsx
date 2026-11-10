import { GATE_LABEL, STAGE_LABEL, Trace } from "@throughline/contracts";
import { Badge, Card, cn, Eyebrow, GateMark } from "@throughline/ui";
import { useState } from "react";
import { useTenantData } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

const SEG = {
  agent: "bg-agent text-agent-ink",
  human: "bg-ion text-background",
  wait: "bg-gate text-gate-ink",
} as const;

/** One work item through every step, gate and tool, with where the time went. */
export function WorkTrace({ workItemKey }: { workItemKey: string }) {
  const { keys } = useTenant();
  const trace = useTenantData(keys.trace(workItemKey), `/trace/${workItemKey}`, Trace);
  const [stepIdx, setStepIdx] = useState(trace.steps.length - 1);
  const step = trace.steps[stepIdx] ?? trace.steps[0];
  const waiting = trace.segments.filter((s) => s.kind === "wait").reduce((a, s) => a + s.days, 0);
  const total = trace.segments.reduce((a, s) => a + s.days, 0) || 1;

  return (
    <>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-display text-heading-md text-strong">Where the {trace.totalDays} days went</h2>
          <span className="text-body-sm text-gate-fg">
            {Math.round((waiting / total) * 100)}% was waiting for people, not agents
          </span>
        </div>
        <div className="flex h-8 gap-0.5 overflow-hidden rounded-md">
          {trace.segments.map((s, i) => (
            <div
              key={`${s.label}-${s.kind}`}
              title={`${s.label} · ${s.days} d`}
              className={cn(
                "animate-rise text-nano flex min-w-0 items-center justify-center overflow-hidden font-mono whitespace-nowrap",
                SEG[s.kind],
              )}
              style={{ flexGrow: s.days, flexBasis: 0, animationDelay: `${i * 0.06}s` }}
            >
              {s.label}
            </div>
          ))}
        </div>
        <div className="text-caption text-muted flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5">
            <span className="bg-agent size-2.5 rounded-xs" />
            Agents working
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-ion size-2.5 rounded-xs" />
            People working
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-gate size-2.5 rounded-xs" />
            Waiting at a gate
          </span>
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <ol className="relative flex flex-col gap-2.5">
          <span aria-hidden className="bg-agent-line absolute top-2 bottom-2 left-6 w-0.5" />
          {trace.steps.map((s, i) => (
            <li key={`${s.stage}-${s.artifact}`}>
              <button
                type="button"
                aria-pressed={i === stepIdx}
                onClick={() => setStepIdx(i)}
                className={cn(
                  "animate-rise relative grid w-full cursor-pointer grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border-2 py-3 pr-3.5 text-left transition-transform hover:translate-x-1",
                  i === stepIdx ? "border-agent bg-agent-wash" : "border-line bg-surface",
                )}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="flex justify-center">
                  {s.gate ? (
                    <GateMark />
                  ) : (
                    <span className="border-agent bg-agent size-3 rounded-full border-2" />
                  )}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-baseline gap-2.5">
                    <span className={cn("text-micro font-mono", s.gate ? "text-gate" : "text-agent-fg")}>
                      {s.gate ? GATE_LABEL[s.gate].toUpperCase() : STAGE_LABEL[s.stage].toUpperCase()}
                    </span>
                    <span className="text-body truncate font-semibold">{s.title}</span>
                  </span>
                  <span className="text-caption text-muted">
                    {s.actor} · {s.when}
                  </span>
                </span>
                <Badge mono>{s.tool}</Badge>
              </button>
            </li>
          ))}
        </ol>
        {step ? (
          <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
            <Card className="flex flex-col gap-3">
              <span className="text-agent-fg text-micro font-mono">
                {STAGE_LABEL[step.stage].toUpperCase()} · {step.artifact}
              </span>
              <h3 className="font-display text-heading-md text-strong">{step.title}</h3>
              <div className="flex flex-wrap gap-2">
                <Badge>Lives in {step.tool}</Badge>
                <Badge tone={step.actorKind === "agent" ? "agent" : "human"}>{step.actor}</Badge>
              </div>
              <Eyebrow className="pt-1">Linked evidence</Eyebrow>
              {step.evidence.map((e) => (
                <div
                  key={e.k}
                  className="bg-surface-raised text-body-sm flex justify-between gap-3 rounded-md px-3 py-2.5"
                >
                  <span>{e.k}</span>
                  <span className="text-micro text-muted font-mono">{e.v}</span>
                </div>
              ))}
            </Card>
            <Card tone="sunken" className="flex flex-col gap-2">
              <div className="text-micro flex justify-between font-mono">
                <span className="text-muted">AUDIT EVENT</span>
                <span className="text-ok">✓ SIGNED</span>
              </div>
              <pre className="text-caption text-subtle font-mono whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    trace: `wi:${trace.workItemKey}`,
                    stage: step.stage,
                    gate: step.gate,
                    artifact: step.artifact,
                    actor: step.actor,
                    system_of_record: step.tool,
                    evidence_hash: step.evidenceHash,
                  },
                  null,
                  2,
                )}
              </pre>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}
