import { Link, useNavigate } from "@tanstack/react-router";
import type { Architecture } from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Eyebrow,
  PageHeader,
  Progress,
  SegmentedControl,
  Select,
} from "@throughline/ui";
import { CircleCheck, FileCode2, FileText, History, LoaderCircle, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { DesignOptions } from "@/features/design";
import { ProjectChip, usePortfolioQuery, useProjectScope } from "@/features/projects";
import { useTenant } from "@/tenancy";
import { useArchitectures } from "./api";
import { BriefForm } from "./BriefForm";
import { ComponentsView } from "./ComponentsView";
import { DiagramViewer } from "./DiagramViewer";
import { DocumentView } from "./DocumentView";
import { download } from "./export/download";

type Tab = "brief" | "diagrams" | "components" | "document";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function Generating({ arch }: { arch: Architecture }) {
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <LoaderCircle className="text-agent size-5 animate-spin" aria-hidden />
        <span className="text-body-lg text-strong font-semibold">
          architect-agent is drawing revision {arch.revision + 1}
        </span>
      </div>
      <Progress value={arch.progress} tone="agent" label="Generation progress" />
      <ol className="flex flex-col gap-2">
        {arch.steps.map((s) => (
          <li
            key={s.label}
            className={cn("text-body-sm flex items-center gap-2", s.done ? "text-foreground" : "text-muted")}
          >
            {s.done ? (
              <CircleCheck className="text-ok size-4" aria-hidden />
            ) : (
              <span className="border-line-strong size-4 rounded-full border" aria-hidden />
            )}
            {s.label}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Exports({ arch, slug }: { arch: Architecture; slug: string }) {
  const [busy, setBusy] = useState(false);
  const drawio = async () => {
    setBusy(true);
    try {
      const { toDrawio } = await import("./export/drawio");
      download(`${slug}.drawio`, toDrawio(arch), "application/vnd.jgraph.mxfile");
    } finally {
      setBusy(false);
    }
  };
  const markdown = async () => {
    const { toMarkdown } = await import("./export/markdown");
    download(`${slug}-architecture.md`, toMarkdown(arch, slug), "text/markdown");
  };
  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => void drawio()}>
          <FileCode2 className="size-4" aria-hidden /> Download .drawio
        </Button>
        <Button variant="secondary" onClick={() => void markdown()}>
          <FileText className="size-4" aria-hidden /> Document (.md)
        </Button>
      </div>
      <span className="text-caption text-muted max-w-sm sm:text-right">
        Opens in draw.io / diagrams.net with Azure, AWS and Google Cloud icons. For Visio: File → Export as →
        VSDX.
      </span>
    </div>
  );
}

function Studio({ arch }: { arch: Architecture }) {
  const { tenant } = useTenant();
  const hasPack = arch.diagrams.length > 0;
  const [tab, setTab] = useState<Tab>(hasPack ? "diagrams" : "brief");
  const [active, setActive] = useState(arch.diagrams.find((d) => d.kind === "deployment")?.id ?? "context");
  const slug = slugify(arch.system);
  const generating = arch.status === "generating";

  const tabs: { id: Tab; label: string; disabled?: boolean }[] = [
    { id: "brief", label: "1 · Brief" },
    {
      id: "diagrams",
      label: `2 · Diagrams${hasPack ? ` (${arch.diagrams.length})` : ""}`,
      disabled: !hasPack,
    },
    {
      id: "components",
      label: `3 · Components${arch.components.length ? ` (${arch.components.length})` : ""}`,
      disabled: !arch.components.length,
    },
    { id: "document", label: "4 · Document", disabled: !arch.document },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg" className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectChip projectId={arch.projectId} />
            <Badge tone="ion" mono>
              {arch.workItemKey}
            </Badge>
            <Badge tone={arch.status === "ready" ? "ok" : arch.status === "stale" ? "gate" : "agent"} mono>
              {arch.status === "ready"
                ? `Revision ${arch.revision}`
                : arch.status === "stale"
                  ? "Brief changed"
                  : arch.status === "generating"
                    ? "Drawing"
                    : "Brief to confirm"}
            </Badge>
          </div>
          <h2 className="font-display text-heading-lg text-strong">{arch.system}</h2>
          <p className="text-body-sm text-subtle">
            {arch.title}
            {arch.briefBy ? ` · brief by ${arch.briefBy}` : ""}
            {arch.generatedAt ? ` · generated ${arch.generatedAt.slice(0, 10)}` : ""}
          </p>
        </div>
        {hasPack ? <Exports arch={arch} slug={slug} /> : null}
      </Card>

      {arch.status === "stale" ? (
        <Card tone="gate" className="flex flex-wrap items-center gap-3">
          <TriangleAlert className="text-gate size-5" aria-hidden />
          <span className="text-body-sm text-gate-fg">
            The brief changed after revision {arch.revision}. Diagrams and document below are from the old
            brief.
          </span>
          <Button variant="gate" size="sm" onClick={() => setTab("brief")}>
            Review and regenerate
          </Button>
        </Card>
      ) : null}

      <div
        role="tablist"
        aria-label="Architecture studio"
        className="border-line flex gap-1 overflow-x-auto border-b"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            disabled={t.disabled}
            onClick={() => setTab(t.id)}
            className={cn(
              "text-body-sm -mb-px shrink-0 cursor-pointer border-b-2 px-4 py-2.5 font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40",
              tab === t.id
                ? "border-agent text-strong"
                : "text-muted hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {generating ? <Generating arch={arch} /> : null}

      {tab === "brief" ? (
        <BriefForm
          key={`${arch.id}-${arch.revision}-${arch.status}`}
          arch={arch}
          onGenerated={() => setTab("diagrams")}
        />
      ) : null}
      {tab === "diagrams" && hasPack && !generating ? (
        <DiagramViewer arch={arch} active={active} onActive={setActive} slug={slug} />
      ) : null}
      {tab === "components" && !generating ? <ComponentsView arch={arch} /> : null}
      {arch.history.length && tab !== "brief" ? (
        <Card className="flex flex-col gap-2">
          <span className="eyebrow text-muted flex items-center gap-1.5">
            <History className="size-3.5" aria-hidden /> Choices changed
          </span>
          <ul className="flex flex-col gap-1">
            {arch.history.map((h) => (
              <li key={`${h.revision}-${h.field}`} className="text-caption text-subtle">
                <span className="text-agent-fg font-mono">r{h.revision}</span> · {h.field}: {h.from} →{" "}
                <span className="text-foreground">{h.to}</span> · {h.by} · {h.at.slice(0, 10)}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {tab === "document" && arch.document && !generating ? (
        <DocumentView
          arch={arch}
          onOpenDiagram={(id) => {
            setActive(id);
            setTab("diagrams");
          }}
        />
      ) : null}

      {arch.status === "ready" ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-body-sm text-subtle">
            The review agents use this pack for the architecture and security review before G2.
          </span>
          <Button asChild variant="secondary">
            <Link to="/t/$tenantSlug/review" params={{ tenantSlug: tenant.slug }}>
              Go to review →
            </Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

function Studios({ selected }: { selected?: string }) {
  const { tenant } = useTenant();
  const all = useArchitectures();
  const [scope, setScope] = useProjectScope(tenant.id);
  const projects = usePortfolioQuery().data?.projects ?? [];
  const items = scope ? all.filter((a) => a.projectId === scope || a.id === selected) : all;
  const [id, setId] = useState(selected ?? items[0]?.id);
  const arch = items.find((a) => a.id === id) ?? items[0];
  const project = (pid: string) => projects.find((p) => p.id === pid);
  if (!arch)
    return (
      <EmptyState
        title="No architecture in this project yet"
        description="Architectures are generated from a project's BRD."
        action={
          scope ? (
            <Button variant="secondary" onClick={() => setScope(null)}>
              Show all projects
            </Button>
          ) : undefined
        }
      />
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          label="Architecture"
          prefix="Architecture"
          variant="toolbar"
          size="lg"
          className="w-md max-w-full"
          value={arch.id}
          onValueChange={setId}
          options={items.map((a) => {
            const p = project(a.projectId);
            return {
              value: a.id,
              label: `${a.workItemKey} · ${a.system}`,
              description: a.title,
              dot:
                a.status === "ready"
                  ? ("ok" as const)
                  : a.status === "stale"
                    ? ("gate" as const)
                    : ("agent" as const),
              group: p ? `${p.key} · ${p.name}` : "Project",
              meta: a.status === "ready" ? `r${a.revision}` : a.status,
            };
          })}
        />
        <span className="text-caption text-muted">
          {scope
            ? `${items.length} in ${project(scope)?.key ?? "this project"} · ${all.length} in total`
            : `${all.length} architectures across ${new Set(all.map((a) => a.projectId)).size} projects`}
        </span>
      </div>
      <Studio key={arch.id} arch={arch} />
    </div>
  );
}

export type ArchitectureView = "studio" | "options";

export function ArchitecturePage({
  selected,
  view = "studio",
  wi,
}: {
  selected?: string;
  view?: ArchitectureView;
  wi?: string;
}) {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Architecture · {tenant.name}</Eyebrow>}
        title={view === "options" ? "Three ways to build it." : "Answer the architect's questions."}
        accent={view === "options" ? "Pick one with eyes open." : "Get real diagrams and a design document."}
      />
      <SegmentedControl
        label="Architecture"
        className="self-start"
        value={view}
        onValueChange={(v) =>
          navigate({
            to: "/t/$tenantSlug/architecture",
            params: { tenantSlug: tenant.slug },
            search: v === "studio" ? {} : { view: v },
          })
        }
        options={[
          { value: "options", label: "Design options" },
          { value: "studio", label: "Architecture studio" },
        ]}
      />
      <QueryBoundary>
        {view === "options" ? (
          <DesignOptions key={wi ?? "all"} wi={wi} />
        ) : (
          <Studios key={selected ?? "all"} selected={selected} />
        )}
      </QueryBoundary>
    </>
  );
}
