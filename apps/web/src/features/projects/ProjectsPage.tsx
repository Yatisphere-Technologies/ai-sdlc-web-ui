import { Link, useNavigate } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { HEALTH_LABEL, type Health } from "@throughline/contracts";
import { Card, cn, Eyebrow, PageHeader, Progress, StatusDot, Tooltip } from "@throughline/ui";
import { ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { DataTable } from "@/components/data/DataTable";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { Can, useTenant } from "@/tenancy";
import { usePortfolio } from "./api";
import { NewProgramDialog, NewProjectDialog } from "./NewProjectDialog";
import { HEALTH_TONE, HealthBadge, money } from "./parts";
import { fmtDate } from "./plan";
import { type ProgramRollup, rollup } from "./rollup";

export function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "gate" | "risk" | "ok";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn(
          "font-display text-heading-md",
          tone === "gate"
            ? "text-gate"
            : tone === "risk"
              ? "text-risk-fg"
              : tone === "ok"
                ? "text-ok"
                : "text-strong",
        )}
      >
        {value}
      </span>
      <span className="text-caption text-muted">{label}</span>
    </div>
  );
}

const HEALTH_ORDER: Record<Health, number> = { "off-track": 0, "at-risk": 1, "on-track": 2 };

/** One dot per project, coloured by its health. */
export function HealthDots({ counts }: { counts: Record<Health, number> }) {
  const order: Health[] = ["off-track", "at-risk", "on-track"];
  const text = order
    .filter((h) => counts[h])
    .map((h) => `${counts[h]} ${HEALTH_LABEL[h].toLowerCase()}`)
    .join(" · ");
  return (
    <Tooltip content={text || "No projects"}>
      <span className="flex flex-wrap items-center gap-1" role="img" aria-label={text || "No projects"}>
        {order.flatMap((h) =>
          Array.from({ length: counts[h] }, (_, i) => `${h}-${i}`).map((id) => (
            <StatusDot key={id} tone={HEALTH_TONE[h]} />
          )),
        )}
      </span>
    </Tooltip>
  );
}

const col = createColumnHelper<ProgramRollup>();

function usePrograms() {
  const { tenant } = useTenant();
  return useMemo(
    () => [
      col.accessor((r) => `${r.program.key} ${r.program.name} ${r.program.owner} ${r.program.sponsor}`, {
        id: "program",
        header: "Program",
        sortingFn: (a, b) => a.original.program.name.localeCompare(b.original.program.name),
        cell: ({ row: { original: r } }) => (
          <span className="flex min-w-56 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-micro text-agent-fg font-mono">{r.program.key}</span>
              <Link
                to="/t/$tenantSlug/projects/program/$programKey"
                params={{ tenantSlug: tenant.slug, programKey: r.program.key }}
                className="text-body text-strong font-semibold hover:underline"
              >
                {r.program.name}
              </Link>
            </span>
            <span className="text-caption text-muted line-clamp-1 max-w-sm">{r.program.objective}</span>
          </span>
        ),
      }),
      col.accessor((r) => HEALTH_ORDER[r.program.health], {
        id: "health",
        header: "Health",
        cell: ({ row: { original: r } }) => <HealthBadge health={r.program.health} />,
      }),
      col.accessor((r) => r.projects.length, {
        id: "projects",
        header: "Projects",
        cell: ({ row: { original: r } }) => (
          <span className="flex items-center gap-2.5">
            <span className="text-foreground font-mono">{r.projects.length}</span>
            <HealthDots counts={r.health} />
          </span>
        ),
      }),
      col.accessor("progress", {
        header: "Progress",
        cell: ({ row: { original: r } }) => (
          <span className="flex min-w-28 items-center gap-2">
            <Progress
              value={r.progress}
              tone={HEALTH_TONE[r.program.health]}
              label={`${r.program.name} progress`}
            />
            <span className="text-caption text-subtle w-8 text-right">{r.progress}%</span>
          </span>
        ),
      }),
      col.accessor((r) => (r.budgetUsd ? r.spentUsd / r.budgetUsd : 0), {
        id: "budget",
        header: "Spent / budget",
        meta: { hideBelow: "md" },
        cell: ({ row: { original: r } }) => (
          <span className="flex min-w-28 flex-col gap-1">
            <span className="text-caption text-subtle whitespace-nowrap">
              {money(r.spentUsd)} / {money(r.budgetUsd)}
            </span>
            <Progress
              value={r.budgetUsd ? (r.spentUsd / r.budgetUsd) * 100 : 0}
              tone={r.spentUsd > r.budgetUsd ? "risk" : "ion"}
              label="Budget used"
            />
          </span>
        ),
      }),
      col.accessor("openGates", {
        header: "Open gates",
        meta: { align: "right", hideBelow: "lg" },
        cell: (c) => (
          <span className={cn("font-mono", c.getValue() ? "text-gate" : "text-muted")}>{c.getValue()}</span>
        ),
      }),
      col.accessor("staleLinks", {
        header: "Out of date",
        meta: { align: "right", hideBelow: "lg" },
        cell: (c) => (
          <span className={cn("font-mono", c.getValue() ? "text-risk-fg" : "text-muted")}>
            {c.getValue()}
          </span>
        ),
      }),
      col.accessor((r) => r.targetDate ?? "", {
        id: "target",
        header: "Target",
        meta: { hideBelow: "md" },
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-col">
            <span className="text-subtle whitespace-nowrap">
              {r.targetDate ? fmtDate(r.targetDate) : "—"}
            </span>
            <span className="text-caption text-muted">{r.program.horizon}</span>
          </span>
        ),
      }),
      col.accessor((r) => r.program.owner, {
        id: "owner",
        header: "Owner",
        meta: { hideBelow: "2xl" },
        cell: ({ row: { original: r } }) => (
          <span className="flex flex-col">
            <span className="text-subtle">{r.program.owner}</span>
            <span className="text-caption text-muted">Sponsor {r.program.sponsor.split(" · ")[0]}</span>
          </span>
        ),
      }),
      col.display({
        id: "open",
        header: () => <span className="sr-only">Open</span>,
        cell: () => <ChevronRight className="text-muted size-4" aria-hidden />,
      }),
    ],
    [tenant.slug],
  );
}

function Projects() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const { programs, projects } = usePortfolio();
  const columns = usePrograms();
  const rows = useMemo(() => programs.map((g) => rollup(g, projects)), [programs, projects]);
  const atRisk = projects.filter((p) => p.health !== "on-track").length;
  const gates = projects.reduce((a, p) => a + p.counts.openGates, 0);
  const stale = projects.reduce((a, p) => a + p.counts.staleLinks, 0);
  const budget = rows.reduce((a, r) => a + r.budgetUsd, 0);
  const spent = projects.reduce((a, p) => a + p.spentUsd, 0);
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Programs & projects · {tenant.name}</Eyebrow>}
        title={`${programs.length} programs, ${projects.length} projects.`}
        accent={
          atRisk ? <span className="text-gate">{atRisk} projects need attention.</span> : "All on track."
        }
        actions={
          <Can action="work.create">
            <NewProgramDialog />
            <NewProjectDialog programs={programs} />
          </Can>
        }
      />
      <Card className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat label="On track" value={projects.filter((p) => p.health === "on-track").length} tone="ok" />
        <Stat label="At risk" value={projects.filter((p) => p.health === "at-risk").length} tone="gate" />
        <Stat label="Off track" value={projects.filter((p) => p.health === "off-track").length} tone="risk" />
        <Tooltip content="Human decisions waiting at a gate across all projects">
          <span>
            <Stat label="Open gates" value={gates} tone={gates ? "gate" : undefined} />
          </span>
        </Tooltip>
        <Tooltip content="Artifacts built from an older version of what they derive from">
          <span>
            <Stat label="Out-of-date links" value={stale} tone={stale ? "risk" : undefined} />
          </span>
        </Tooltip>
        <Stat label="Spent of budget" value={`${money(spent)} / ${money(budget)}`} />
      </Card>
      <DataTable
        label="Programs"
        data={rows}
        columns={columns}
        search="Search programs, owners, sponsors"
        initialSort={[{ id: "health", desc: false }]}
        onRowOpen={(r) =>
          navigate({
            to: "/t/$tenantSlug/projects/program/$programKey",
            params: { tenantSlug: tenant.slug, programKey: r.program.key },
          })
        }
        empty="No programs match"
      />
    </>
  );
}

export function ProjectsPage() {
  return (
    <QueryBoundary>
      <Projects />
    </QueryBoundary>
  );
}
