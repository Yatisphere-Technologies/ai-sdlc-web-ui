import { Link, useNavigate } from "@tanstack/react-router";
import {
  ARTIFACT_TYPE_LABEL,
  type ArtifactSummary,
  type ArtifactType,
  GATE_LABEL,
  LIFECYCLE_LABEL,
  LINK_LABEL,
  type LifecycleStep,
  type ProjectOverview,
  STAGE_LABEL,
} from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Eyebrow,
  GateMark,
  Progress,
  Skeleton,
  type Tone,
  Tooltip,
} from "@throughline/ui";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleDashed,
  Clock,
  FilePlus2,
  GitBranch,
  Link2,
  Link2Off,
  Plus,
  Sparkles,
} from "lucide-react";
import { Suspense, useEffect } from "react";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { gateLink, WorkspaceLink } from "@/features/approvals/links";
import { useAssistant, useAssistantPageContext } from "@/features/assistant";
import { Can, useTenant } from "@/tenancy";
import { useProjectOverview } from "./api";
import { PlanView } from "./PlanView";
import {
  ArtifactRefLink,
  HEALTH_TONE,
  HealthBadge,
  money,
  PhaseBadge,
  PlatformBadge,
  RefChip,
} from "./parts";
import { fmtDate } from "./plan";
import { setProjectScope } from "./scope";
import { WorkList } from "./work/WorkList";
import { WorkTrace } from "./work/WorkTrace";

export type ProjectTab = "overview" | "plan" | "artifacts" | "trace" | "work";
const TABS: { id: ProjectTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Plan" },
  { id: "artifacts", label: "Artifacts" },
  { id: "trace", label: "Traceability" },
  { id: "work", label: "Work items & trace" },
];

const STEP: Record<LifecycleStep["state"], { icon: typeof Circle; tone: string; label: string }> = {
  done: { icon: CheckCircle2, tone: "text-ok border-ok", label: "Done" },
  active: { icon: Circle, tone: "text-agent-fg border-agent", label: "In progress" },
  waiting: { icon: Clock, tone: "text-gate border-gate", label: "Waiting" },
  stale: { icon: AlertTriangle, tone: "text-risk-fg border-risk", label: "Out of date" },
  "not-started": { icon: CircleDashed, tone: "text-faint border-line", label: "Not started" },
};

function Lifecycle({ steps }: { steps: LifecycleStep[] }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
      {steps.map((s, i) => {
        const meta = STEP[s.state];
        const Icon = meta.icon;
        return (
          <li
            key={s.stage}
            className={cn("bg-surface flex flex-col gap-2 rounded-xl border-2 p-3.5", meta.tone)}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="text-micro font-mono">{i + 1}</span>
              <span className="text-body-sm text-strong font-semibold">{LIFECYCLE_LABEL[s.stage]}</span>
            </div>
            <span className="text-caption text-subtle">
              <span className="sr-only">{meta.label}: </span>
              {s.note}
            </span>
            {s.refs.length ? (
              <div className="mt-auto flex flex-wrap gap-1.5">
                {s.refs.slice(0, 3).map((r) => (
                  <ArtifactRefLink
                    key={`${r.type}-${r.id}`}
                    refTo={r}
                    className="text-caption text-foreground font-mono"
                  >
                    {r.id}
                  </ArtifactRefLink>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

const ORDER: ArtifactType[] = [
  "brd",
  "architecture",
  "plan",
  "backlog",
  "spec",
  "design",
  "review",
  "build",
  "release",
  "incident",
];

function Artifacts({ items }: { items: ArtifactSummary[] }) {
  if (!items.length)
    return <EmptyState title="Nothing in this project yet" description="Start with a BRD." />;
  return (
    <Card padding="none" className="overflow-x-auto">
      <table className="w-full min-w-3xl border-collapse text-left">
        <thead>
          <tr className="border-line border-b">
            {["Type", "Artifact", "Status", "Work item", "Updated"].map((h) => (
              <th key={h} scope="col" className="eyebrow text-muted px-4 py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...items]
            .sort((a, b) => ORDER.indexOf(a.ref.type) - ORDER.indexOf(b.ref.type))
            .map((a) => (
              <tr
                key={`${a.ref.type}-${a.ref.id}`}
                className="border-surface-raised hover:bg-surface-raised border-b"
              >
                <td className="text-caption text-muted px-4 py-3">{ARTIFACT_TYPE_LABEL[a.ref.type]}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <ArtifactRefLink refTo={a.ref} className="text-body-sm text-foreground font-medium">
                      {a.title}
                    </ArtifactRefLink>
                    <span className="text-micro text-faint font-mono">{a.key}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={a.tone as Tone}>{a.status}</Badge>
                </td>
                <td className="text-caption text-subtle px-4 py-3 font-mono">{a.workItemKey ?? "—"}</td>
                <td className="text-caption text-subtle px-4 py-3 font-mono">
                  {a.updatedAt ? fmtDate(a.updatedAt.slice(0, 10)) : "—"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </Card>
  );
}

function Traceability({ o }: { o: ProjectOverview }) {
  if (!o.links.length)
    return (
      <EmptyState
        title="No links yet"
        description="Links appear when an architecture or backlog is built from a BRD."
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-sm text-subtle max-w-3xl">
        How this project's artifacts depend on each other. A link is <strong>out of date</strong> when the
        thing it was built from has moved to a newer version, so whatever was built from it needs a look.
      </p>
      <ul className="flex flex-col gap-2">
        {o.links.map((l) => (
          <li
            key={l.id}
            className={cn(
              "bg-surface flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-4 py-3",
              l.state === "stale" ? "border-risk" : "border-line",
            )}
          >
            <RefChip refTo={l.from} />
            <span className="text-caption text-muted flex items-center gap-1">
              {LINK_LABEL[l.kind]} <ArrowRight className="size-3" aria-hidden />
            </span>
            <RefChip refTo={l.to} />
            {l.version ? (
              <Badge mono tone={l.state === "stale" ? "risk" : "neutral"}>
                v{l.version}
              </Badge>
            ) : null}
            {l.state === "stale" ? (
              <Badge tone="risk">
                <Link2Off className="size-3" aria-hidden /> Out of date
              </Badge>
            ) : (
              <Badge tone="ok">
                <Link2 className="size-3" aria-hidden /> Current
              </Badge>
            )}
            <span className="text-caption text-subtle basis-full sm:basis-auto sm:pl-2">{l.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Overview({ o }: { o: ProjectOverview }) {
  const { tenant } = useTenant();
  const p = o.project;
  const open = o.gates.filter((g) => g.status === "open");
  return (
    <div className="flex flex-col gap-5">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <Eyebrow>Lifecycle · where this project is</Eyebrow>
          <span className="text-caption text-muted">Each step lists the artifacts behind it</span>
        </div>
        <Lifecycle steps={o.lifecycle} />
      </Card>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="flex flex-col gap-3 xl:col-span-2">
          <Eyebrow>Health</Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <HealthBadge health={p.health} />
            <span className="text-body-sm text-subtle">{p.healthNote}</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-muted">Progress</span>
              <span className="font-display text-heading-md text-strong">{p.progress}%</span>
              <Progress value={p.progress} tone={HEALTH_TONE[p.health]} label="Project progress" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-muted">Budget</span>
              <span className="font-display text-heading-md text-strong">
                {money(p.spentUsd)} <span className="text-muted text-body">/ {money(p.budgetUsd)}</span>
              </span>
              <Progress
                value={(p.spentUsd / Math.max(1, p.budgetUsd)) * 100}
                tone={p.spentUsd / Math.max(1, p.budgetUsd) > p.progress / 100 + 0.15 ? "risk" : "ion"}
                label="Budget spent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-muted">Work by stage</span>
              <div className="flex flex-wrap gap-1.5">
                {o.stages.map((s) => (
                  <Badge key={s.stage}>
                    {STAGE_LABEL[s.stage]} · {s.count}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <Card className="flex flex-col gap-3">
          <Eyebrow>Decisions waiting · {open.length}</Eyebrow>
          {open.length ? (
            open.map((g) => (
              <WorkspaceLink
                key={g.id}
                to={gateLink(g.gate, g.workItemKey)}
                className="bg-surface-raised hover:bg-surface-sunken flex items-start gap-2.5 rounded-lg px-3 py-2.5"
              >
                <GateMark size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body-sm text-foreground">{g.title}</span>
                  <span className="text-caption text-muted">
                    {GATE_LABEL[g.gate]} · {g.meta}
                  </span>
                </div>
                <ChevronRight className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
              </WorkspaceLink>
            ))
          ) : (
            <span className="text-body-sm text-muted">No gate is waiting on a person.</span>
          )}
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="flex flex-col gap-3">
          <Eyebrow>Related projects</Eyebrow>
          {o.related.length ? (
            o.related.map((r) => (
              <Link
                key={`${r.direction}-${r.key}`}
                to="/t/$tenantSlug/projects/$projectKey"
                params={{ tenantSlug: tenant.slug, projectKey: r.key }}
                className="border-line hover:border-agent flex flex-col gap-1 rounded-lg border px-3 py-2.5"
              >
                <span className="text-caption text-muted">
                  {r.direction === "depends-on" ? "Depends on" : "Used by"}
                </span>
                <span className="text-body-sm text-foreground font-medium">
                  <span className="text-agent-fg font-mono">{r.key}</span> · {r.name}
                </span>
                <span className="text-caption text-subtle">{r.note}</span>
              </Link>
            ))
          ) : (
            <span className="text-body-sm text-muted">This project doesn't depend on another one.</span>
          )}
        </Card>
        <Card className="flex flex-col gap-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>Next milestones</Eyebrow>
            <Link
              to="/t/$tenantSlug/projects/$projectKey"
              params={{ tenantSlug: tenant.slug, projectKey: p.key }}
              search={{ tab: "plan" }}
              className="text-caption text-agent-fg flex items-center gap-1"
            >
              Full plan <ChevronRight className="size-3" aria-hidden />
            </Link>
          </div>
          {o.plan?.milestones
            .filter((m) => m.status !== "done")
            .slice(0, 4)
            .map((m) => (
              <div key={m.id} className="flex flex-wrap items-center gap-3">
                <span className="text-micro text-faint w-8 font-mono">{m.id}</span>
                <span className="text-body-sm text-foreground flex-1">{m.title}</span>
                {m.dependsOn.some((d) => d.includes(":")) ? (
                  <Tooltip content={`Waits for ${m.dependsOn.filter((d) => d.includes(":")).join(", ")}`}>
                    <span>
                      <Badge tone="ion">Cross-project</Badge>
                    </span>
                  </Tooltip>
                ) : null}
                <Badge tone={m.status === "late" ? "risk" : m.status === "in-progress" ? "agent" : "neutral"}>
                  {m.status === "late" ? "Late" : m.status === "in-progress" ? "In progress" : "Upcoming"}
                </Badge>
                <span className="text-caption text-subtle w-28 text-right font-mono">{fmtDate(m.due)}</span>
              </div>
            )) ?? <span className="text-body-sm text-muted">No plan yet.</span>}
        </Card>
      </div>
    </div>
  );
}

/** Work items in the project; picking one follows it through every step, gate and tool. */
function WorkItems({ o, item }: { o: ProjectOverview; item?: string }) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const selected = o.workItems.find((w) => w.key === item)?.key ?? o.workItems[0]?.key ?? null;
  return (
    <div className="flex flex-col gap-5">
      <WorkList
        items={o.workItems}
        selected={selected}
        onOpen={(key) =>
          navigate({
            to: "/t/$tenantSlug/projects/$projectKey",
            params: { tenantSlug: tenant.slug, projectKey: o.project.key },
            search: { tab: "work", item: key },
            replace: true,
            resetScroll: false,
          })
        }
      />
      {selected ? (
        <section aria-label={`Trace of ${selected}`} className="flex flex-col gap-4">
          <Eyebrow>Trace · {selected} · every step, every tool</Eyebrow>
          <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
            <WorkTrace key={selected} workItemKey={selected} />
          </Suspense>
        </section>
      ) : null}
    </div>
  );
}

function Project({ projectKey, tab, item }: { projectKey: string; tab: ProjectTab; item?: string }) {
  const { tenant } = useTenant();
  const o = useProjectOverview(projectKey);
  const p = o.project;
  // Opening a project makes it the working scope for the module pages.
  useEffect(() => setProjectScope(tenant.id, p.id), [tenant.id, p.id]);
  const assistant = useAssistant();
  useAssistantPageContext({ label: `Project ${p.key}`, path: `/projects/${p.key}`, projectId: p.id });
  const today = new Date().toISOString().slice(0, 10);
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
        <Link
          to="/t/$tenantSlug/projects/program/$programKey"
          params={{ tenantSlug: tenant.slug, programKey: o.program.key }}
          className="hover:text-foreground"
        >
          {o.program.key} · {o.program.name}
        </Link>
        <ChevronRight className="size-3" aria-hidden />
        <span className="text-foreground">{p.key}</span>
      </nav>
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-micro text-agent-fg font-mono">PROJECT · {p.key}</span>
          <HealthBadge health={p.health} />
          <PhaseBadge phase={p.phase} />
          {p.platform ? <PlatformBadge /> : null}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-4xl flex-col gap-2">
            <h1 className="font-display text-display-md text-strong">{p.name}</h1>
            <p className="text-body text-subtle">{p.objective}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                assistant.open({
                  prompt: `Summarise ${p.key}: health, risks and what's next`,
                  context: { label: `Project ${p.key}`, path: `/projects/${p.key}`, projectId: p.id },
                  fresh: true,
                })
              }
            >
              <Sparkles className="size-4" aria-hidden /> Ask about {p.key}
            </Button>
            <Can action="brd.edit">
              <Button variant="secondary" asChild>
                <Link to="/t/$tenantSlug/brd/new" params={{ tenantSlug: tenant.slug }}>
                  <FilePlus2 className="size-4" aria-hidden /> New BRD in {p.key}
                </Link>
              </Button>
            </Can>
          </div>
        </div>
        <dl className="border-line bg-surface grid gap-x-8 gap-y-3 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
          {[
            ["Sponsor", p.sponsor],
            ["Owner", p.owner],
            ["Teams", p.teams.join(", ")],
            ["Dates", `${fmtDate(p.startDate)} → ${fmtDate(p.targetDate)}`],
            ["Jira project", p.tools.jira ?? "Not linked"],
            ["Repository", p.tools.repo ?? "Not linked"],
            ["Cloud", p.tools.cloud ?? "Not set"],
            ["Confluence", p.tools.confluence ?? "Not linked"],
          ].map(([k, v]) => (
            <div key={k} className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-caption text-muted">{k}</dt>
              <dd className="text-body-sm text-foreground truncate">{v}</dd>
            </div>
          ))}
        </dl>
      </header>
      <div role="tablist" aria-label="Project views" className="border-line flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.id}
            role="tab"
            aria-selected={t.id === tab}
            to="/t/$tenantSlug/projects/$projectKey"
            params={{ tenantSlug: tenant.slug, projectKey: p.key }}
            search={t.id === "overview" ? {} : { tab: t.id }}
            className={cn(
              "text-body-sm -mb-px border-b-2 px-3.5 py-2.5 font-medium",
              t.id === tab
                ? "border-agent text-strong"
                : "text-muted hover:text-foreground border-transparent",
            )}
          >
            {t.label}
            {t.id === "artifacts" ? (
              <span className="text-faint ml-1.5 font-mono">{o.artifacts.length}</span>
            ) : null}
            {t.id === "trace" && p.counts.staleLinks ? (
              <span className="text-risk-fg ml-1.5 font-mono">{p.counts.staleLinks}</span>
            ) : null}
            {t.id === "work" ? (
              <span className="text-faint ml-1.5 font-mono">{o.workItems.length}</span>
            ) : null}
          </Link>
        ))}
      </div>
      {tab === "overview" ? <Overview o={o} /> : null}
      {tab === "plan" ? (
        o.plan ? (
          <PlanView plan={o.plan} today={today} projectKey={p.key} />
        ) : (
          <EmptyState title="No plan yet" icon={<Plus className="size-5" />} />
        )
      ) : null}
      {tab === "artifacts" ? <Artifacts items={o.artifacts} /> : null}
      {tab === "trace" ? <Traceability o={o} /> : null}
      {tab === "work" ? (
        o.workItems.length ? (
          <WorkItems o={o} item={item} />
        ) : (
          <EmptyState
            title="No work items yet"
            icon={<GitBranch className="size-5" />}
            description="A work item is created with the first BRD."
          />
        )
      ) : null}
    </>
  );
}

export function ProjectPage({
  projectKey,
  tab,
  item,
}: {
  projectKey: string;
  tab: ProjectTab;
  item?: string;
}) {
  return (
    <QueryBoundary>
      <Project projectKey={projectKey} tab={tab} item={item} />
    </QueryBoundary>
  );
}
