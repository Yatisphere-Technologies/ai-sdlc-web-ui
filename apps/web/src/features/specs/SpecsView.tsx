import type { Spec } from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  cn,
  EmptyState,
  GateMark,
  Progress,
} from "@throughline/ui";
import { Check, CircleCheck } from "lucide-react";
import { useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { PickList } from "@/components/data/PickList";
import { useTenant } from "@/tenancy";
import { useApproveSpec, useSpecs, useToggleCheck } from "./api";

const REQ_TAG = {
  agreed: { label: "Agreed", tone: "ok" },
  "open-question": { label: "Open question", tone: "gate" },
  "agent-checking": { label: "Agent checking", tone: "agent" },
} as const;

function Gate({ spec }: { spec: Spec }) {
  const { can } = useTenant();
  const toggle = useToggleCheck();
  const approve = useApproveSpec();
  const allowed = can("gate.approve.g1");
  const done = spec.checklist.filter((c) => c.done).length;
  const all = done === spec.checklist.length;
  const approved = spec.status === "approved";

  return (
    <Card tone={approved ? "ok" : "gate"} className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-heading-md text-strong flex items-center gap-2.5">
          <GateMark state={approved ? "approved" : "open"} /> Gate G1 · Spec
        </h2>
        <span className={cn("text-micro font-mono", approved ? "text-ok" : "text-gate")}>
          {approved ? "APPROVED" : `${done}/${spec.checklist.length}`}
        </span>
      </div>
      <Progress
        value={approved ? 100 : (done / spec.checklist.length) * 100}
        tone={approved ? "ok" : "gate"}
        size="md"
        label="G1 checklist"
      />
      {approved ? (
        <span className="animate-pop text-body text-ok flex items-center gap-2 font-semibold">
          <CircleCheck className="size-5" aria-hidden /> Approved by {spec.approvedBy} · plan released to
          agents
        </span>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {spec.checklist.map((c) => (
              <li key={c.id}>
                <label
                  className={cn(
                    "text-body-sm flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 has-[:disabled]:cursor-not-allowed",
                    c.done ? "border-agent-line bg-agent-wash" : "border-line bg-surface-raised",
                  )}
                >
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={c.done}
                    disabled={!allowed || toggle.isPending}
                    onChange={() => toggle.mutate({ specId: spec.id, itemId: c.id, done: !c.done })}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "peer-focus-visible:outline-agent flex size-5 shrink-0 items-center justify-center rounded-xs border-2 peer-focus-visible:outline-2",
                      c.done ? "border-agent bg-agent text-agent-ink" : "border-line-strong",
                    )}
                  >
                    {c.done ? <Check className="size-3.5" /> : null}
                  </span>
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
          {allowed ? (
            <Button
              variant="gate"
              size="lg"
              disabled={!all || approve.isPending}
              onClick={() => approve.mutate(spec.id)}
            >
              {all
                ? "Approve spec and release plan"
                : `Complete ${spec.checklist.length - done} more check${spec.checklist.length - done === 1 ? "" : "s"}`}
            </Button>
          ) : (
            <span className="text-caption text-muted">A product owner approves at G1. You can view.</span>
          )}
          <ErrorNote error={toggle.error ?? approve.error} />
        </>
      )}
    </Card>
  );
}

function SpecDetail({ spec }: { spec: Spec }) {
  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="agent">Drafted by {spec.author}</Badge>
          <Badge tone="human">Owner · {spec.owner}</Badge>
          <Badge>Risk tier {spec.risk}</Badge>
        </div>
        {spec.requirements.map((r, i) => (
          <Card
            key={r.id}
            interactive
            padding="sm"
            className={cn("animate-rise flex flex-col gap-3", r.question && "border-gate-line")}
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2.5">
                <span className="text-agent text-caption font-mono">{r.id}</span>
                <span className="text-body font-semibold">{r.title}</span>
              </span>
              <Badge tone={REQ_TAG[r.status].tone}>{REQ_TAG[r.status].label}</Badge>
            </div>
            <p className="border-line bg-surface-sunken text-caption text-subtle rounded-md border p-3.5 font-mono">
              <span className="text-ion">{r.keyword1}</span> {r.clause1}{" "}
              <span className="text-ion">{r.keyword2}</span> {r.clause2}{" "}
              <span className="text-agent">SHALL</span> {r.response}
            </p>
            {r.question ? (
              <p className="border-gate-line bg-gate-wash text-body-sm text-gate-fg flex gap-2.5 rounded-md border p-3">
                <span className="text-gate text-micro font-mono">OPEN Q</span> {r.question}
              </p>
            ) : null}
            <span className="text-caption text-muted">{r.checks} acceptance checks</span>
          </Card>
        ))}
      </div>
      <div className="flex flex-col gap-5">
        <Gate spec={spec} />
        <Card className="flex flex-col gap-2.5">
          <CardHeader className="mb-1">
            <CardTitle>Planned tasks</CardTitle>
            <span
              className={cn(
                "text-micro font-mono",
                spec.status === "approved" ? "text-agent-fg" : "text-gate",
              )}
            >
              {spec.status === "approved" ? "RUNNING" : "HELD AT G1"}
            </span>
          </CardHeader>
          {spec.tasks.map((t) => (
            <div key={t.id} className="bg-surface-raised flex flex-col gap-2 rounded-md p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-body-sm font-semibold">{t.title}</span>
                <Badge tone={t.kind === "agent" ? "agent" : "human"}>{t.assignee}</Badge>
              </div>
              <Progress
                value={spec.status === "approved" ? 35 : 0}
                working={spec.status === "approved"}
                label={`${t.title} progress`}
              />
              <span className="text-faint text-micro font-mono">
                {t.id} · {t.requirements.join(", ")}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

/** Specs at G1, list and detail. `wi` (a spec id or work item key) preselects one for deep links. */
export function SpecsView({ wi }: { wi?: string }) {
  const specs = useSpecs();
  const [selectedId, setSelectedId] = useState(
    specs.find((s) => s.id === wi || s.workItemKey === wi)?.id ?? specs[0]?.id ?? "",
  );
  const spec = specs.find((s) => s.id === selectedId) ?? specs[0];
  if (!spec) return <EmptyState title="No specs yet" description="Specs are drafted from a signed BRD." />;
  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <PickList
        label="Specs"
        items={specs}
        selectedId={spec.id}
        onSelect={setSelectedId}
        render={(s) => (
          <>
            <span className="flex items-center justify-between gap-2">
              <span className="text-faint text-micro font-mono">{s.id}</span>
              <Badge tone={s.status === "approved" ? "ok" : "gate"} mono>
                {s.status === "approved" ? "Approved" : "At G1"}
              </Badge>
            </span>
            <span className="text-body font-semibold">{s.title}</span>
            <span className="text-caption text-muted">
              {s.requirements.length} requirements · {s.requirements.filter((r) => r.question).length} open
              questions
            </span>
          </>
        )}
      />
      <SpecDetail key={spec.id} spec={spec} />
    </div>
  );
}
