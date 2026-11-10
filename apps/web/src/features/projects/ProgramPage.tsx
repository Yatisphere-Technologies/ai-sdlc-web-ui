import { Link, useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { PHASE_LABEL, type ProjectPhase, type ProjectSummary } from "@throughline/contracts";
import { Badge, Button, Card, cn, EmptyState, Progress, Tooltip } from "@throughline/ui";
import { ArrowLeft, ChevronRight, Target } from "lucide-react";
import { useMemo } from "react";
import { DataTable } from "@/components/data/DataTable";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { Can, useTenant } from "@/tenancy";
import { usePortfolio } from "./api";
import { NewProjectDialog } from "./NewProjectDialog";
import { HealthDots, Stat } from "./ProjectsPage";
import { HEALTH_TONE, HealthBadge, money, PlatformBadge } from "./parts";
import { fmtDate } from "./plan";
import { rollup, usedBy } from "./rollup";
import { setProjectScope } from "./scope";

const PHASES = Object.keys(PHASE_LABEL) as ProjectPhase[];
const HEALTH_ORDER = { "off-track": 0, "at-risk": 1, "on-track": 2 } as const;
const col = createColumnHelper<ProjectSummary>();

function useColumns(all: ProjectSummary[]) {
  const { tenant } = useTenant();
  return useMemo(
    () => [
      col.accessor((p) => `${p.key} ${p.name} ${p.owner} ${p.teams.join(" ")}`, {
        id: "project",
        header: "Project",
        sortingFn: (a, b) => a.original.name.localeCompare(b.original.name),
        cell: ({ row: { original: p } }) => (
          <span className="flex min-w-56 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2">
              <span className="text-micro text-agent-fg font-mono">{p.key}</span>
              <Link
                to="/t/$tenantSlug/projects/$projectKey"
                params={{ tenantSlug: tenant.slug, projectKey: p.key }}
                onClick={() => setProjectScope(tenant.id, p.id)}
                className="text-body text-strong font-semibold hover:underline"
              >
                {p.name}
              </Link>
              {p.platform ? <PlatformBadge /> : null}
            </span>
            <span className="text-caption text-muted line-clamp-1 max-w-sm">{p.objective}</span>
          </span>
        ),
      }),
      col.accessor((p) => PHASES.indexOf(p.phase), {
        id: "phase",
        header: "Phase",
        cell: ({ row: { original: p } }) => <Badge>{PHASE_LABEL[p.phase]}</Badge>,
      }),
      col.accessor((p) => HEALTH_ORDER[p.health], {
        id: "health",
        header: "Health",
        cell: ({ row: { original: p } }) =>
          p.health === "on-track" ? (
            <HealthBadge health={p.health} />
          ) : (
            <Tooltip content={p.healthNote}>
              <span className="flex max-w-56 flex-col gap-0.5">
                <HealthBadge health={p.health} />
                <span className="text-caption text-gate-fg line-clamp-1">{p.healthNote}</span>
              </span>
            </Tooltip>
          ),
      }),
      col.accessor("progress", {
        header: "Progress",
        cell: ({ row: { original: p } }) => (
          <span className="flex min-w-28 items-center gap-2">
            <Progress value={p.progress} tone={HEALTH_TONE[p.health]} label={`${p.name} progress`} />
            <span className="text-caption text-subtle w-8 text-right">{p.progress}%</span>
          </span>
        ),
      }),
      col.accessor("targetDate", {
        header: "Target",
        meta: { hideBelow: "md" },
        cell: ({ row: { original: p } }) => (
          <span className="text-subtle flex items-center gap-1 whitespace-nowrap">
            <Target className="text-muted size-3" aria-hidden /> {fmtDate(p.targetDate)}
          </span>
        ),
      }),
      col.accessor((p) => p.counts.workItems, {
        id: "work",
        header: "Items · artifacts",
        meta: { align: "right", hideBelow: "lg" },
        cell: ({ row: { original: p } }) => (
          <span className="text-caption text-subtle whitespace-nowrap">
            {p.counts.workItems} · {p.counts.artifacts}
          </span>
        ),
      }),
      col.accessor((p) => p.counts.openGates, {
        id: "gates",
        header: "Gates",
        meta: { align: "right", hideBelow: "lg" },
        cell: (c) => (
          <span className={cn("font-mono", c.getValue() ? "text-gate" : "text-muted")}>{c.getValue()}</span>
        ),
      }),
      col.accessor((p) => p.counts.staleLinks, {
        id: "stale",
        header: "Out of date",
        meta: { align: "right", hideBelow: "2xl" },
        cell: (c) => (
          <span className={cn("font-mono", c.getValue() ? "text-risk-fg" : "text-muted")}>
            {c.getValue()}
          </span>
        ),
      }),
      col.accessor((p) => (p.budgetUsd ? p.spentUsd / p.budgetUsd : 0), {
        id: "budget",
        header: "Spent / budget",
        meta: { hideBelow: "md" },
        cell: ({ row: { original: p } }) => (
          <span className="flex min-w-28 flex-col gap-1">
            <span className="text-caption text-subtle whitespace-nowrap">
              {money(p.spentUsd)} / {money(p.budgetUsd)}
            </span>
            <Progress
              value={p.budgetUsd ? (p.spentUsd / p.budgetUsd) * 100 : 0}
              tone={p.spentUsd > p.budgetUsd ? "risk" : "ion"}
              label="Budget used"
            />
          </span>
        ),
      }),
      col.display({
        id: "links",
        header: "Depends on / used by",
        meta: { hideBelow: "2xl" },
        cell: ({ row: { original: p } }) => {
          const users = usedBy(all, p.key);
          return p.dependsOn.length || users.length ? (
            <span className="flex flex-wrap gap-1">
              {p.dependsOn.map((k) => (
                <Badge key={`d-${k}`} tone="ion">
                  → {k}
                </Badge>
              ))}
              {users.map((k) => (
                <Badge key={`u-${k}`}>← {k}</Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted">—</span>
          );
        },
      }),
      col.display({
        id: "open",
        header: () => <span className="sr-only">Open</span>,
        cell: () => <ChevronRight className="text-muted size-4" aria-hidden />,
      }),
    ],
    [tenant.slug, tenant.id, all],
  );
}

function Program({ programKey }: { programKey: string }) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { programs, projects } = usePortfolio();
  const program = programs.find((g) => g.key === programKey);
  const columns = useColumns(projects);
  if (!program)
    return (
      <EmptyState
        title={`No program ${programKey}`}
        description="It may have been closed or belong to another workspace."
        action={
          <Button asChild variant="secondary">
            <Link to="/t/$tenantSlug/projects" params={{ tenantSlug: tenant.slug }}>
              All programs
            </Link>
          </Button>
        }
      />
    );
  const r = rollup(program, projects);
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-caption text-muted flex flex-wrap items-center gap-1.5">
        <Link
          to="/t/$tenantSlug/projects"
          params={{ tenantSlug: tenant.slug }}
          className="hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="size-3" aria-hidden /> Programs & projects
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-foreground">
          {program.key} · {program.name}
        </span>
      </nav>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-micro text-agent-fg font-mono">PROGRAM · {program.key}</span>
          <HealthBadge health={program.health} />
          <Badge>{program.status}</Badge>
          <Badge>{program.horizon}</Badge>
          <span className="ml-auto">
            <Can action="work.create">
              <NewProjectDialog programs={programs} defaultProgram={program.id} />
            </Can>
          </span>
        </div>
        <h1 className="font-display text-display-md text-strong">{program.name}</h1>
        <p className="text-body text-subtle max-w-4xl">{program.objective}</p>
        <span className="text-caption text-muted">
          Sponsor {program.sponsor} · Owner {program.owner}
        </span>
      </header>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <Card className="grid grid-cols-2 items-start gap-x-8 gap-y-5 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Stat label="Projects" value={r.projects.length} />
            <HealthDots counts={r.health} />
          </div>
          <Stat label="Progress (by budget)" value={`${r.progress}%`} />
          <Stat label="Open gates" value={r.openGates} tone={r.openGates ? "gate" : undefined} />
          <Stat label="Out-of-date links" value={r.staleLinks} tone={r.staleLinks ? "risk" : undefined} />
          <Stat
            label="Spent of budget"
            value={`${money(r.spentUsd)} / ${money(r.budgetUsd)}`}
            tone={r.spentUsd > r.budgetUsd ? "risk" : undefined}
          />
          <Stat label="Latest target" value={r.targetDate ? fmtDate(r.targetDate) : "—"} />
        </Card>
        {program.outcomes.length ? (
          <Card className="flex flex-col gap-2">
            <span className="eyebrow text-muted">Outcomes</span>
            <dl className="flex flex-col gap-1.5">
              {program.outcomes.map((o) => (
                <div key={o.metric} className="flex flex-wrap justify-between gap-x-4">
                  <dt className="text-body-sm text-subtle">{o.metric}</dt>
                  <dd className="text-body-sm text-foreground font-mono">
                    {o.baseline} → <span className="text-ok">{o.target}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        ) : null}
      </div>
      <DataTable
        label={`Projects in ${program.name}`}
        data={r.projects}
        columns={columns}
        search="Search projects, owners, teams"
        initialSort={[{ id: "health", desc: false }]}
        onRowOpen={(p) => {
          setProjectScope(tenant.id, p.id);
          navigate({
            to: "/t/$tenantSlug/projects/$projectKey",
            params: { tenantSlug: tenant.slug, projectKey: p.key },
          });
        }}
        empty={r.projects.length ? "No projects match" : "No projects in this program yet"}
      />
    </>
  );
}

export function ProgramPage({ programKey }: { programKey: string }) {
  return (
    <QueryBoundary>
      <Program programKey={programKey} />
    </QueryBoundary>
  );
}
