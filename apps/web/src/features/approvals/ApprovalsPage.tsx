import {
  Badge,
  Button,
  Card,
  EmptyState,
  Eyebrow,
  GateMark,
  PageHeader,
  SegmentedControl,
} from "@throughline/ui";
import { ArrowRight, CircleCheck, Inbox } from "lucide-react";
import { useState } from "react";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { useApproveGate } from "@/features/control-room/api";
import { ProjectLabel } from "@/features/projects";
import { useTenant } from "@/tenancy";
import { useApprovals } from "./api";
import type { Approval } from "./model";
import { WorkspaceLink } from "./WorkspaceLink";

type Filter = "mine" | "all";

function Row({ a }: { a: Approval }) {
  const approve = useApproveGate();
  const done = approve.isSuccess;
  return (
    <li>
      <Card
        tone={a.mine ? "gate" : undefined}
        padding="sm"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <GateMark state={done ? "approved" : "open"} className="mt-1 shrink-0" />
          <div className="flex min-w-0 flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-micro text-gate font-mono">{a.kind.toUpperCase()}</span>
              {a.workItemKey ? (
                <span className="text-micro text-faint font-mono">{a.workItemKey}</span>
              ) : null}
              {a.mine ? (
                <Badge tone="gate" mono>
                  Waiting for you
                </Badge>
              ) : null}
            </span>
            <span className="text-body text-strong font-semibold">{a.title}</span>
            <span className="text-caption text-muted">{a.meta}</span>
            {a.projectId ? <ProjectLabel projectId={a.projectId} /> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {done ? (
            <span className="animate-pop text-body-sm text-ok flex items-center gap-1.5 font-semibold">
              <CircleCheck className="size-4" aria-hidden /> Approved
            </span>
          ) : a.decisionId && a.mine ? (
            <Button
              variant="gate"
              size="sm"
              disabled={approve.isPending}
              onClick={() => a.decisionId && approve.mutate(a.decisionId)}
            >
              {approve.isPending ? "Approving…" : "Approve"}
            </Button>
          ) : null}
          <Button asChild variant="secondary" size="sm">
            <WorkspaceLink to={a.to}>
              {a.decisionId ? "Review evidence" : "Open to sign"}{" "}
              <ArrowRight className="size-3.5" aria-hidden />
            </WorkspaceLink>
          </Button>
        </div>
      </Card>
      {approve.isError ? <span className="text-caption text-risk-fg">{approve.error.message}</span> : null}
    </li>
  );
}

function Queue() {
  const all = useApprovals();
  const mine = all.filter((a) => a.mine);
  const [filter, setFilter] = useState<Filter>(mine.length ? "mine" : "all");
  const items = filter === "mine" ? mine : all;
  const kinds = [...new Set(items.map((a) => a.kind))];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Show"
          value={filter}
          onValueChange={setFilter}
          options={[
            { value: "mine", label: `Waiting on me · ${mine.length}` },
            { value: "all", label: `All open · ${all.length}` },
          ]}
        />
        <span className="text-caption text-muted">
          Gate decisions can be approved here. BRDs and test plans open so you read before you sign.
        </span>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title={filter === "mine" ? "Nothing is waiting on you" : "No sign-offs are open"}
          description="Agents ask here when a gate needs a person."
        />
      ) : (
        kinds.map((k) => (
          <section key={k} aria-label={k} className="flex flex-col gap-2.5">
            <Eyebrow>
              {k} · {items.filter((a) => a.kind === k).length}
            </Eyebrow>
            <ul className="flex flex-col gap-2.5">
              {items
                .filter((a) => a.kind === k)
                .map((a) => (
                  <Row key={a.id} a={a} />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export function ApprovalsPage() {
  const { tenant } = useTenant();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Approvals · {tenant.name}</Eyebrow>}
        title="Every sign-off in one place."
        accent="Agents wait; you decide."
      />
      <QueryBoundary>
        <Queue />
      </QueryBoundary>
    </>
  );
}
