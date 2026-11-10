import { Link } from "@tanstack/react-router";
import { type Action, GATE_LABEL, type GateDecision } from "@throughline/contracts";
import { Button, Card, CardHeader, CardTitle, EmptyState, GateMark } from "@throughline/ui";
import { CircleCheck } from "lucide-react";
import { gateLink, WorkspaceLink } from "@/features/approvals/links";
import { useTenant } from "@/tenancy";
import { useApproveGate } from "./api";

function DecisionRow({ decision }: { decision: GateDecision }) {
  const { can } = useTenant();
  const approve = useApproveGate();
  const allowed = can(`gate.approve.${decision.gate}` as Action);
  const done = decision.status === "approved";

  return (
    <li>
      <Card tone={done ? "ok" : "gate"} padding="sm" interactive className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <GateMark state={done ? "approved" : "open"} className="mt-1" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className={done ? "text-micro text-ok font-mono" : "text-micro text-gate font-mono"}>
              {GATE_LABEL[decision.gate].toUpperCase()} · {decision.workItemKey}
            </span>
            <span className="text-body font-semibold">{decision.title}</span>
            <span className="text-caption text-muted">{decision.meta}</span>
          </div>
        </div>
        {done ? (
          <span className="animate-pop text-body-sm text-ok flex items-center gap-2 font-semibold">
            <CircleCheck className="size-4" aria-hidden /> Approved by {decision.approvedBy} · agents released
          </span>
        ) : allowed ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="gate"
              size="sm"
              disabled={approve.isPending}
              onClick={() => approve.mutate(decision.id)}
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
            <Button asChild variant="secondary" size="sm">
              <WorkspaceLink to={gateLink(decision.gate, decision.workItemKey)}>
                Review evidence
              </WorkspaceLink>
            </Button>
          </div>
        ) : (
          <span className="text-caption text-muted">
            Another role approves this gate.{" "}
            <WorkspaceLink
              to={gateLink(decision.gate, decision.workItemKey)}
              className="text-agent-fg hover:underline"
            >
              View the evidence
            </WorkspaceLink>
          </span>
        )}
        {approve.isError ? <span className="text-caption text-risk-fg">{approve.error.message}</span> : null}
      </Card>
    </li>
  );
}

export function DecisionQueue({ decisions }: { decisions: GateDecision[] }) {
  const { tenant } = useTenant();
  const open = decisions.filter((d) => d.status === "open").length;
  return (
    <Card className="animate-rise flex flex-col gap-3" style={{ animationDelay: "0.4s" }}>
      <CardHeader className="mb-0">
        <CardTitle>Decisions</CardTitle>
        <Link
          to="/t/$tenantSlug/approvals"
          params={{ tenantSlug: tenant.slug }}
          className="text-micro text-gate font-mono hover:underline"
        >
          {open} WAITING · ALL APPROVALS →
        </Link>
      </CardHeader>
      {decisions.length === 0 ? (
        <EmptyState
          title="No decisions waiting"
          description="Agents will ask here when a gate needs a person."
          className="py-8"
        />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {decisions.map((d) => (
            <DecisionRow key={d.id} decision={d} />
          ))}
        </ul>
      )}
    </Card>
  );
}
