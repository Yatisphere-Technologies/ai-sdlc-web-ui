import { type VerifyChange, VerifyList } from "@throughline/contracts";
import { Badge, Button, Card, CardHeader, CardTitle, cn, EmptyState, GateMark } from "@throughline/ui";
import { Check, CircleCheck } from "lucide-react";
import { useState } from "react";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { ItemPicker } from "./ItemPicker";

const CELL = {
  pass: "border-ok-line bg-ok-soft text-ok",
  fixed: "border-gate-line bg-gate-soft text-gate",
  running: "border-ion text-ion animate-pulse",
  na: "border-line text-ghost",
} as const;

function ConfidenceDial({ value }: { value: number }) {
  const c = 302;
  return (
    <div className="relative size-40">
      <svg viewBox="0 0 120 120" className="size-40 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="48" className="stroke-line" strokeWidth="10" fill="none" />
        <circle
          cx="60"
          cy="60"
          r="48"
          className="stroke-ok ease-out-soft transition-[stroke-dashoffset] duration-1000"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={Math.round(c * (1 - value / 100))}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-display-md text-strong">{value}</span>
        <span className="text-faint text-nano font-mono">OF 100</span>
      </span>
    </div>
  );
}

function Change({ change }: { change: VerifyChange }) {
  const { keys, can } = useTenant();
  const sign = useTenantWrite(keys.verify, VerifyList, (id: string) => ({
    method: "post",
    path: `/verify/${id}/sign`,
  }));
  const merged = change.status === "merged";
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <Card className="flex flex-col gap-3">
          <CardHeader className="mb-1">
            <CardTitle>Requirement → evidence</CardTitle>
            <span className="text-caption text-muted flex gap-3">
              <span className="flex items-center gap-1.5">
                <span className="bg-ok size-2.5 rounded-xs" />
                Pass
              </span>
              <span className="flex items-center gap-1.5">
                <span className="bg-gate size-2.5 rounded-xs" />
                Fixed in review
              </span>
              <span className="flex items-center gap-1.5">
                <span className="border-ion size-2.5 rounded-xs border" />
                Running
              </span>
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl border-separate border-spacing-1.5 text-left">
              <thead>
                <tr>
                  <th scope="col" className="sr-only">
                    Requirement
                  </th>
                  {change.columns.map((c) => (
                    <th key={c} scope="col" className="eyebrow text-muted text-center font-normal">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {change.rows.map((r, ri) => (
                  <tr key={r.req}>
                    <th scope="row" className="pr-3 font-normal">
                      <span className="text-agent text-caption font-mono">{r.req}</span>{" "}
                      <span className="text-body-sm text-subtle">{r.title}</span>
                    </th>
                    {r.cells.map((cell, ci) => (
                      <td key={`${r.req}-${change.columns[ci]}`} className="text-center">
                        <span
                          className={cn(
                            "animate-pop text-caption inline-flex size-7 items-center justify-center rounded-sm border-2 font-bold",
                            CELL[cell],
                          )}
                          style={{ animationDelay: `${0.2 + (ri * r.cells.length + ci) * 0.03}s` }}
                          title={cell}
                        >
                          {cell === "pass" ? (
                            <Check className="size-3.5" aria-label="pass" />
                          ) : cell === "fixed" ? (
                            "!"
                          ) : cell === "na" ? (
                            "–"
                          ) : (
                            ""
                          )}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card className="flex flex-col gap-2.5">
          <CardTitle className="mb-1">What the reviewers found</CardTitle>
          {change.findings.map((f) => (
            <div
              key={f.id}
              className="bg-surface-raised grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-lg p-3.5"
            >
              <Badge
                tone={
                  f.severity === "high" || f.severity === "critical"
                    ? "risk"
                    : f.severity === "medium"
                      ? "gate"
                      : "ion"
                }
                mono
              >
                {f.severity}
              </Badge>
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-semibold">{f.title}</span>
                <span className="text-caption text-muted">{f.source}</span>
              </span>
              <span className={cn("text-micro font-mono", f.state === "Fixed" ? "text-ok" : "text-muted")}>
                {f.state.toUpperCase()}
              </span>
            </div>
          ))}
        </Card>
      </div>
      <div className="flex flex-col gap-5">
        <Card className="flex flex-col items-center gap-3">
          <CardTitle className="self-start">Change confidence</CardTitle>
          <ConfidenceDial value={change.confidence} />
          <dl className="text-body-sm flex w-full flex-col gap-2">
            {[
              ["Blast radius", change.blastRadius],
              ["Mutation score", change.mutationScore],
              ["Rollback", change.rollback],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card tone={merged ? "ok" : "gate"} className="flex flex-col gap-3">
          <h2 className="font-display text-heading-md text-strong flex items-center gap-2.5">
            <GateMark state={merged ? "approved" : "open"} /> G3 · two keys
          </h2>
          {change.keys.map((k) => (
            <div key={k.role} className="bg-surface-raised flex items-center gap-3 rounded-lg p-3">
              <span
                className={cn(
                  "text-micro flex size-9 items-center justify-center rounded-sm font-mono",
                  k.role === "agent" ? "bg-agent-soft text-agent" : "bg-human-soft text-human-fg",
                )}
              >
                {k.role === "agent" ? "RV" : "TL"}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-body-sm font-semibold">{k.name}</span>
                <span className={cn("text-caption", k.signed ? "text-ok" : "text-gate-fg")}>
                  {k.signed ? "Signed" : "Waiting for signature"}
                </span>
              </span>
            </div>
          ))}
          {merged ? (
            <span className="animate-pop text-body text-ok flex items-center gap-2 font-semibold">
              <CircleCheck className="size-5" aria-hidden /> Merged · signed build queued for release
            </span>
          ) : can("gate.approve.g3") ? (
            <Button variant="gate" size="lg" disabled={sign.isPending} onClick={() => sign.mutate(change.id)}>
              Sign as key 2 and merge
            </Button>
          ) : (
            <span className="text-caption text-muted">
              A tech lead signs the second key. You can review the evidence.
            </span>
          )}
          <ErrorNote error={sign.error} />
        </Card>
      </div>
    </div>
  );
}

/** The evidence locker for each change at G3. `wi` preselects the change for a work item. */
export function VerifyView({ wi }: { wi?: string }) {
  const { keys } = useTenant();
  const { items } = useTenantData(keys.verify, "/verify", VerifyList);
  const [id, setId] = useState(items.find((c) => c.workItemKey === wi)?.id ?? items[0]?.id ?? "");
  const change = items.find((c) => c.id === id) ?? items[0];
  if (!change) return <EmptyState title="Nothing waiting for verification" />;
  return (
    <>
      <ItemPicker
        label="Change"
        items={items.map((c) => ({ id: c.id, label: `${c.prKey} · ${c.title} · ${c.workItemKey}` }))}
        value={change.id}
        onChange={setId}
      />
      <Change key={change.id} change={change} />
    </>
  );
}
