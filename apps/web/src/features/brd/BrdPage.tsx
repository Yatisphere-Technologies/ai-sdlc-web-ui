import { Link, useNavigate } from "@tanstack/react-router";
import { BRD_STATUS_LABEL, brdScore, checkBrd } from "@throughline/contracts";
import { Badge, Button, cn, EmptyState, Eyebrow, PageHeader, SegmentedControl } from "@throughline/ui";
import { ArrowRight, MessageSquarePlus } from "lucide-react";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { inScope, ProjectLabel, ScopeNote, useProjectScope } from "@/features/projects";
import { SpecsView } from "@/features/specs";
import { useTenant } from "@/tenancy";
import { useBacklogs, useBrds } from "./api";

const STATUS_TONE = {
  draft: "neutral",
  "in-review": "gate",
  "changes-requested": "risk",
  approved: "ok",
} as const;
function List() {
  const { tenant, can } = useTenant();
  const all = useBrds();
  const [scope, setScope] = useProjectScope(tenant.id);
  const brds = inScope(all, scope, (b) => b.projectId);
  const backlogs = useBacklogs();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-subtle">
          {brds.length} BRD{brds.length === 1 ? "" : "s"} ·{" "}
          {brds.filter((b) => b.status === "in-review").length} in review ·{" "}
          {brds.filter((b) => b.status === "approved").length} approved
        </p>
        <ScopeNote shown={brds.length} total={all.length} onClear={() => setScope(null)} />
        {can("brd.edit") ? (
          <Button asChild>
            <Link to="/t/$tenantSlug/brd/new" params={{ tenantSlug: tenant.slug }}>
              <MessageSquarePlus className="size-4" aria-hidden /> New BRD
            </Link>
          </Button>
        ) : null}
      </div>
      {brds.length === 0 ? (
        <EmptyState title="No BRDs yet" description="Start one and the BA agent will interview you." />
      ) : null}
      <ul className="grid gap-3 lg:grid-cols-2">
        {brds.map((b) => {
          const score = brdScore(checkBrd(b.content));
          const backlog = backlogs.find((x) => x.brdId === b.id);
          const approved = b.approvals.filter((a) => a.status === "approved").length;
          return (
            <li key={b.id}>
              <Link
                to="/t/$tenantSlug/brd/$brdId"
                params={{ tenantSlug: tenant.slug, brdId: b.id }}
                className="hover-lift border-line bg-surface hover:border-agent-line flex h-full flex-col gap-3 rounded-2xl border p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="ion" mono>
                    {b.id}
                  </Badge>
                  <Badge tone={STATUS_TONE[b.status]} mono>
                    {BRD_STATUS_LABEL[b.status]} · v{b.version}
                  </Badge>
                  {b.status === "in-review" && b.approvals.some((a) => a.isMe && a.status === "pending") ? (
                    <Badge tone="gate" mono>
                      Waiting for you
                    </Badge>
                  ) : null}
                  <span
                    className={cn(
                      "text-micro ml-auto font-mono",
                      score >= 85 ? "text-ok" : score >= 60 ? "text-gate" : "text-risk",
                    )}
                  >
                    {score}/100
                  </span>
                </div>
                <ProjectLabel projectId={b.projectId} />
                <span className="font-display text-heading-md text-strong">{b.title}</span>
                <span className="text-body-sm text-subtle line-clamp-2">
                  {b.content.summary || "Not written yet."}
                </span>
                <span className="text-caption text-muted mt-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>{b.content.requirements.length} requirements</span>
                  <span>
                    {approved}/{b.approvals.length} approvals
                  </span>
                  <span>
                    {backlog?.items.length
                      ? `${backlog.items.filter((i) => i.type === "story").length} stories`
                      : "No backlog yet"}
                  </span>
                  <span className="text-agent-fg ml-auto flex items-center gap-1">
                    Open studio <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type BrdView = "brds" | "specs";

export function BrdPage({ view = "brds", wi }: { view?: BrdView; wi?: string }) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>BRDs & specs · {tenant.name}</Eyebrow>}
        title={view === "brds" ? "Business requirements, written together." : "Say exactly what done means."}
        accent={view === "brds" ? "Signed, then broken into a backlog." : "Then hold agents to it at G1."}
      />
      <SegmentedControl
        label="Requirements"
        className="self-start"
        value={view}
        onValueChange={(v) =>
          navigate({
            to: "/t/$tenantSlug/brd",
            params: { tenantSlug: tenant.slug },
            search: v === "brds" ? {} : { view: v },
          })
        }
        options={[
          { value: "brds", label: "BRDs" },
          { value: "specs", label: "Specs · G1" },
        ]}
      />
      <QueryBoundary>{view === "brds" ? <List /> : <SpecsView key={wi ?? "all"} wi={wi} />}</QueryBoundary>
    </>
  );
}
