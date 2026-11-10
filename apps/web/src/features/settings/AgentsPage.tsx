import {
  type AgentIdentity,
  type AgentPolicy,
  AUTONOMY_LABEL,
  type Autonomy,
  DATA_CLASS_LABEL,
  type DataClass,
  ENFORCEMENT_LABEL,
} from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  cn,
  Progress,
  Select,
  Skeleton,
  StatusDot,
  SwitchRow,
} from "@throughline/ui";
import { OctagonX, Play } from "lucide-react";
import { Suspense, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { useTenant } from "@/tenancy";
import { ago, Field, Frameworks, INPUT } from "./parts";
import { ReadOnlyNotice } from "./ReadOnlyNotice";
import { useAgentGov, useKillSwitch, useUpdateAgent, useUpdatePolicy } from "./security.api";

const AUTONOMY: Autonomy[] = ["suggest", "approve", "act"];
const CLASSES: DataClass[] = ["public", "internal", "confidential", "restricted"];
const CATEGORY_LABEL: Record<AgentPolicy["category"], string> = {
  code: "Code",
  data: "Data",
  release: "Release",
  spend: "Spend",
  tools: "Tools",
};
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function KillSwitchCard({ manage }: { manage: boolean }) {
  const { killSwitch, agents } = useAgentGov();
  const kill = useKillSwitch();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const running = agents.filter((a) => a.status === "active").length;
  const engage = !killSwitch.engaged;
  return (
    <Card tone={killSwitch.engaged ? "risk" : "sunken"} className="flex flex-wrap items-center gap-4">
      <OctagonX
        className={cn("size-6 shrink-0", killSwitch.engaged ? "text-risk" : "text-muted")}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body text-strong font-semibold">
          {killSwitch.engaged
            ? "All agents are stopped"
            : `Kill switch · ${running} of ${agents.length} agents running`}
        </span>
        <span className="text-caption text-muted">
          {killSwitch.engaged
            ? `Stopped by ${killSwitch.by} ${ago(killSwitch.at)}. In-flight tool calls were cancelled and credentials suspended.`
            : "Stops every agent at once: tool calls are cancelled, sandboxes frozen and agent credentials suspended."}
        </span>
      </div>
      {manage ? (
        <Button variant={engage ? "danger" : "gate"} onClick={() => setOpen(true)}>
          {engage ? (
            "Stop all agents"
          ) : (
            <>
              <Play className="size-4" aria-hidden /> Release
            </>
          )}
        </Button>
      ) : null}
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setReason("");
        }}
        tone={engage ? "danger" : "gate"}
        title={engage ? "Stop every agent now?" : "Release the kill switch?"}
        description={
          engage
            ? "Use this for a suspected compromise or runaway behaviour. People keep working; agents resume only when someone releases the switch."
            : "Agents the switch stopped resume; agents suspended before it stay suspended."
        }
        confirmLabel={engage ? "Stop all agents" : "Release"}
        busy={kill.isPending || reason.trim().length < 3}
        onConfirm={() =>
          kill.mutate(
            { engaged: engage, reason },
            {
              onSettled: () => {
                setOpen(false);
                setReason("");
              },
            },
          )
        }
      >
        <Field id="kill-reason" label="Reason (recorded in the audit log)">
          <input
            id="kill-reason"
            className={INPUT}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}

function AgentCard({ a, manage, frozen }: { a: AgentIdentity; manage: boolean; frozen: boolean }) {
  const update = useUpdateAgent();
  const spend = a.budgetUsd ? Math.round((a.spentUsd / a.budgetUsd) * 100) : 0;
  const err = update.error;
  return (
    <Card padding="sm" className={cn("flex flex-col gap-3", a.status === "suspended" && "opacity-80")}>
      <div className="flex items-start gap-3">
        <span className="bg-agent-soft text-agent text-micro flex size-9 shrink-0 items-center justify-center rounded-sm font-mono">
          {a.code}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-body-sm text-foreground flex items-center gap-2 font-semibold">
            <StatusDot tone={a.status === "active" ? "ok" : "risk"} live={a.status === "active"} />
            {a.name}
          </span>
          <span className="text-caption text-muted">{a.purpose}</span>
        </div>
        <Badge tone={a.status === "active" ? "ok" : "risk"}>{a.status}</Badge>
      </div>
      <dl className="text-caption grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-muted">Identity</dt>
        <dd className="text-subtle truncate">{a.identity}</dd>
        <dt className="text-muted">Credential</dt>
        <dd className={cn(a.credential.type === "secret" ? "text-gate-fg" : "text-subtle")}>
          {a.credential.type === "federated"
            ? "Federated (no secret)"
            : a.credential.type === "managed-identity"
              ? "Managed identity"
              : `Client secret · rotated ${ago(a.credential.rotatedAt)}`}
        </dd>
        <dt className="text-muted">Owner</dt>
        <dd className="text-subtle">{a.owner}</dd>
        <dt className="text-muted">Last 30 days</dt>
        <dd className="text-subtle">
          {a.actions30d.toLocaleString()} actions ·{" "}
          <span className={a.denied30d > 10 ? "text-gate-fg" : ""}>{a.denied30d} blocked</span> · last{" "}
          {ago(a.lastActionAt)}
        </dd>
      </dl>
      <div className="flex flex-wrap gap-1">
        {a.scopes.map((s) => (
          <span
            key={s}
            className={cn(
              "text-nano rounded-xs border px-1.5 py-0.5 font-mono",
              s.includes("prod") || s.includes("write")
                ? "border-gate-line text-gate-fg"
                : "border-line text-muted",
            )}
          >
            {s}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-caption text-muted">Tools</span>
        {a.tools.map((t) => (
          <span
            key={t}
            className="border-line text-caption text-subtle flex items-center gap-1 rounded-xs border py-0.5 pr-1.5 pl-0.5"
          >
            <BrandLogo brand={t} size="xs" fallback="·" className="border-0" />
            {t}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select
          label={`Autonomy for ${a.name}`}
          size="sm"
          variant="toolbar"
          disabled={!manage}
          value={a.autonomy}
          onValueChange={(autonomy) => update.mutate({ id: a.id, autonomy })}
          options={AUTONOMY.map((x) => ({ value: x, label: AUTONOMY_LABEL[x] }))}
        />
        <Select
          label={`Data access for ${a.name}`}
          size="sm"
          variant="toolbar"
          disabled={!manage}
          value={a.dataAccess}
          onValueChange={(dataAccess) => update.mutate({ id: a.id, dataAccess })}
          options={CLASSES.map((x) => ({ value: x, label: `Up to ${DATA_CLASS_LABEL[x].toLowerCase()}` }))}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-caption flex justify-between">
          <span className="text-muted">
            {a.model} · {usd.format(a.spentUsd)} of {usd.format(a.budgetUsd)} this month
          </span>
          <span className={spend > 100 ? "text-risk-fg" : spend > 80 ? "text-gate-fg" : "text-muted"}>
            {spend}%
          </span>
        </span>
        <Progress
          value={Math.min(spend, 100)}
          tone={spend > 100 ? "risk" : spend > 80 ? "gate" : "agent"}
          label="Budget used"
        />
      </div>
      {err ? <span className="text-caption text-risk-fg">{err.message}</span> : null}
      {manage ? (
        <div className="flex flex-wrap gap-2">
          {a.status === "active" ? (
            <Button
              size="sm"
              variant="danger"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: a.id, status: "suspended" })}
            >
              Suspend
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={update.isPending || frozen}
              onClick={() => update.mutate({ id: a.id, status: "active" })}
            >
              Resume
            </Button>
          )}
          {a.spentUsd >= a.budgetUsd ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: a.id, budgetUsd: Math.ceil((a.spentUsd * 1.5) / 50) * 50 })}
            >
              Raise budget to {usd.format(Math.ceil((a.spentUsd * 1.5) / 50) * 50)}
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Policies({ manage }: { manage: boolean }) {
  const { policies } = useAgentGov();
  const update = useUpdatePolicy();
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle className="text-heading-sm">Guardrails</CardTitle>
        <span className="text-caption text-muted">
          Enforced at the tool gateway, before an agent's action runs
        </span>
      </CardHeader>
      {update.error ? <span className="text-caption text-risk-fg">{update.error.message}</span> : null}
      {policies.map((p) => (
        <div key={p.id} className="flex flex-col gap-1.5">
          <SwitchRow
            label={p.name}
            description={p.description}
            checked={p.enabled}
            warnWhenOff={p.enforcement === "block"}
            disabled={!manage || update.isPending}
            onCheckedChange={(enabled) => update.mutate({ id: p.id, enabled })}
          />
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Badge>{CATEGORY_LABEL[p.category]}</Badge>
            <span className="text-caption text-muted">Stepped in {p.hits30d}× in 30 days</span>
            <Frameworks items={p.frameworks} />
            <span className="ml-auto">
              <Select
                label={`Enforcement for ${p.name}`}
                size="sm"
                variant="toolbar"
                disabled={!manage || !p.enabled}
                value={p.enforcement}
                onValueChange={(enforcement) => update.mutate({ id: p.id, enforcement })}
                options={(["block", "approve", "log"] as const).map((e) => ({
                  value: e,
                  label: ENFORCEMENT_LABEL[e],
                }))}
              />
            </span>
          </div>
        </div>
      ))}
    </Card>
  );
}

function Agents() {
  const { can } = useTenant();
  const { agents, killSwitch } = useAgentGov();
  const manage = can("policies.manage");
  return (
    <>
      {manage ? null : <ReadOnlyNotice what="agents and guardrails" />}
      <KillSwitchCard manage={manage} />
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle className="text-heading-sm">Agent identities · {agents.length}</CardTitle>
            <span className="text-caption text-muted">
              One workload identity per agent, least-privilege scopes
            </span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {agents.map((a) => (
              <AgentCard key={a.id} a={a} manage={manage} frozen={killSwitch.engaged} />
            ))}
          </div>
        </div>
        <Policies manage={manage} />
      </div>
    </>
  );
}

export function AgentsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Agents />
    </Suspense>
  );
}
