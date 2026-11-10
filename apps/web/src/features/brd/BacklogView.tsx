import {
  BACKLOG_KIND_LABEL,
  type Backlog,
  type BacklogKind,
  type BacklogType,
  type Brd,
  isPushable,
  mustCoverage,
  storyChecks,
  TOOL_LABEL,
  TOOL_TYPES,
} from "@throughline/contracts";
import {
  Button,
  Card,
  ConfirmDialog,
  cn,
  EmptyState,
  Eyebrow,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Progress,
  Select,
  type Tone,
  Tooltip,
  toast,
} from "@throughline/ui";
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Download,
  LoaderCircle,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { download } from "../architecture/export/download";
import { useGenerateBacklog, usePushBacklog } from "./api";
import { BacklogTree } from "./backlog/BacklogTree";
import { ItemDetail } from "./backlog/ItemDetail";
import { buildIndex, rollup, sprintPlan, type TreeFilter, visibleIds } from "./backlog/meta";
import { KIND_TONE, TYPE } from "./backlog/parts";
import { Readiness, SprintPlan, Traceability } from "./backlog/Views";

type View = "tree" | "plan" | "trace" | "ready";
const VIEWS: { id: View; label: string }[] = [
  { id: "tree", label: "Hierarchy" },
  { id: "plan", label: "Sprint plan" },
  { id: "trace", label: "Traceability" },
  { id: "ready", label: "Ready & done" },
];
const KIND_HINT: Record<BacklogKind, string> = {
  business: "Delivers a business requirement",
  enabler: "Platform work behind a quality target",
  compliance: "Security, regulatory or audit obligation",
  transition: "Go-live: baselines, training, cut-over",
  spike: "Time-boxed investigation of an open question",
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "gate" }) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "font-display text-heading-md leading-none",
          tone === "ok" ? "text-ok" : tone === "gate" ? "text-gate-fg" : "text-strong",
        )}
      >
        {value}
      </span>
      <span className="text-nano text-muted mt-1 font-mono tracking-wide uppercase">{label}</span>
    </div>
  );
}

/**
 * The delivery backlog generated from the approved BRD. Fills its container: a summary bar, view
 * tabs (hierarchy, sprint plan, traceability, ready & done) and a details panel for the selected item.
 */
export function BacklogView({ brd, backlog }: { brd: Brd; backlog: Backlog }) {
  const { can } = useTenant();
  const generate = useGenerateBacklog();
  const push = usePushBacklog();
  const [view, setView] = useState<View>("tree");
  const [confirmPush, setConfirmPush] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<TreeFilter>({ q: "", release: "all", kind: "all", notReady: false });
  const ix = useMemo(() => buildIndex(backlog.items), [backlog.items]);
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(backlog.items.filter((i) => i.type === "epic" || i.type === "feature").map((i) => i.id)),
  );
  const item = selected ? ix.byId.get(selected) : undefined;
  const visible = useMemo(() => visibleIds(ix, backlog.items, filter), [ix, backlog.items, filter]);

  if (brd.status !== "approved" && backlog.status === "none") {
    const done = brd.approvals.filter((a) => a.status === "approved").length;
    return (
      <div className="overflow-y-auto p-6">
        <EmptyState
          title="The backlog is generated from the approved BRD"
          description={`${done} of ${brd.approvals.length} approvals in. Once everyone signs, the BA agent breaks it into epics, features, stories and sub-tasks.`}
        />
      </div>
    );
  }
  if (backlog.status === "generating") {
    return (
      <div className="overflow-y-auto p-6">
        <Card padding="lg" className="mx-auto flex max-w-3xl flex-col gap-4">
          <span className="text-body-lg text-strong flex items-center gap-2 font-semibold">
            <LoaderCircle className="text-agent size-5 animate-spin" aria-hidden /> BA agent is writing the
            backlog from {brd.id} v{brd.version}
          </span>
          <Progress value={backlog.progress} tone="agent" label="Backlog generation" />
          <p className="text-body-sm text-muted">
            Grouping requirements into epics, writing user stories with Given/When/Then criteria and test
            scenarios, attaching NFRs, rules and data, planning transition work and sprints.
          </p>
        </Card>
      </div>
    );
  }
  if (backlog.status === "none") {
    return (
      <div className="overflow-y-auto p-6">
        <Card padding="lg" className="mx-auto flex max-w-3xl flex-col items-start gap-3">
          <Eyebrow>Approved · v{brd.version}</Eyebrow>
          <p className="text-body text-subtle">
            Turn {brd.content.requirements.filter((r) => r.priority !== "wont").length} business requirements,{" "}
            {brd.content.nfrs.length} non-functional requirements and {brd.content.rules.length} rules into a
            traced, sprint-planned backlog for {TOOL_LABEL[backlog.target]}: epics with outcomes and scope,
            features with business value, stories with acceptance criteria, test scenarios and a definition of
            done, estimated sub-tasks, go-live transition work and spikes for open questions. Won't-haves are
            left out.
          </p>
          {can("work.create") ? (
            <Button
              size="lg"
              disabled={generate.isPending}
              onClick={() => generate.mutate({ id: backlog.id })}
            >
              <Sparkles className="size-4" aria-hidden /> Generate backlog
            </Button>
          ) : (
            <p className="text-caption text-muted">A product owner generates the backlog.</p>
          )}
          <ErrorNote error={generate.error} />
        </Card>
      </div>
    );
  }

  const items = backlog.items;
  const count = (t: BacklogType) => items.filter((i) => i.type === t).length;
  const stories = items.filter((i) => i.type === "story");
  const pts = stories.reduce((a, s) => a + (s.points ?? 0), 0);
  const hours = items.filter((i) => i.type === "subtask").reduce((a, t) => a + (t.hours ?? 0), 0);
  const plan = sprintPlan(items);
  const ready = stories.filter((s) => storyChecks(s).length === 0).length;
  const cov = mustCoverage(brd.content, items);
  const unpushed = items.filter((i) => !i.external && isPushable(backlog.target, i)).length;
  const slug = brd.id.toLowerCase();
  const types = TOOL_TYPES[backlog.target];
  const releases = [...new Set(items.map((i) => i.release).filter((r): r is string => Boolean(r)))];
  const kinds = [...new Set(items.map((i) => i.kind))] as BacklogKind[];
  const mvp = plan.filter((s) => s.release === "MVP").length;
  const expandable = items.filter((i) => i.type !== "subtask" && (ix.children.get(i.id) ?? []).length);

  return (
    <div className="@container relative flex h-full min-h-0 flex-col">
      {backlog.status === "stale" ? (
        <div className="border-gate-line bg-gate-wash flex flex-wrap items-center gap-3 border-b px-4 py-2">
          <TriangleAlert className="text-gate size-4" aria-hidden />
          <span className="text-body-sm text-gate-fg">
            Generated from v{backlog.brdVersion}; the BRD is now v{brd.version}.{" "}
            {brd.status === "approved"
              ? "Regenerate to pick up the changes (tool keys are kept)."
              : "Regenerate once the change is approved."}
          </span>
          {brd.status === "approved" && can("work.create") ? (
            <>
              <Button variant="gate" size="sm" onClick={() => setConfirmRegen(true)}>
                Regenerate
              </Button>
              <ConfirmDialog
                open={confirmRegen}
                onOpenChange={setConfirmRegen}
                title={`Regenerate the backlog from v${brd.version}?`}
                description="Items are rebuilt from the approved BRD. Keys already created in the tool are kept; edits you made to items here are replaced."
                confirmLabel="Regenerate"
                tone="gate"
                onConfirm={() => {
                  setConfirmRegen(false);
                  generate.mutate({ id: backlog.id });
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      <header className="border-line flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-4 py-3">
        <Stat label="Epics" value={String(count("epic"))} />
        <Stat label="Features" value={String(count("feature"))} />
        <Stat label="Stories" value={String(stories.length)} />
        <Stat label="Sub-tasks" value={String(count("subtask"))} />
        <Stat label="Points" value={String(pts)} />
        <Stat label="Hours" value={hours.toLocaleString("en-IN")} />
        <Stat label={`Sprints · ${mvp} to MVP`} value={String(plan.length)} />
        <Stat
          label="Must coverage"
          value={`${cov.covered}/${cov.total}`}
          tone={cov.missing.length ? "gate" : "ok"}
        />
        <Stat
          label="Ready"
          value={`${ready}/${stories.length}`}
          tone={ready === stories.length ? "ok" : "gate"}
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-caption text-muted hidden @5xl:inline">
            {TOOL_LABEL[backlog.target]} · {backlog.project} ·{" "}
            {backlog.pushedAt ? `pushed by ${backlog.pushedBy}` : "not pushed yet"}
          </span>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Download className="size-3.5" aria-hidden /> Export
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem
                onSelect={async () => {
                  const { toJiraCsv } = await import("./export/backlogCsv");
                  download(`${slug}-jira-import.csv`, toJiraCsv(backlog), "text/csv");
                  toast.success("Jira CSV downloaded", {
                    description: "Import it in Jira: Settings → System → External system import → CSV.",
                  });
                }}
              >
                Jira CSV import
              </MenuItem>
              <MenuItem
                onSelect={async () => {
                  const { toAdoCsv } = await import("./export/backlogCsv");
                  download(`${slug}-azure-boards-import.csv`, toAdoCsv(backlog), "text/csv");
                  toast.success("Azure Boards CSV downloaded", {
                    description: "Import it in Boards → Work items → Import from CSV.",
                  });
                }}
              >
                Azure Boards CSV import
              </MenuItem>
              <MenuSeparator />
              <MenuLabel>
                In {TOOL_LABEL[backlog.target]}:{" "}
                {(Object.keys(types) as BacklogType[])
                  .map((t) => `${TYPE[t].label} → ${types[t]}`)
                  .join(" · ")}
              </MenuLabel>
            </MenuContent>
          </Menu>
          {can("work.create") ? (
            <Button
              size="sm"
              disabled={
                push.isPending || unpushed === 0 || backlog.status !== "ready" || !backlog.targetConnected
              }
              onClick={() => setConfirmPush(true)}
            >
              <Send className="size-3.5" aria-hidden />
              {unpushed === 0
                ? `All in ${TOOL_LABEL[backlog.target]}`
                : `Create ${unpushed} in ${TOOL_LABEL[backlog.target]}`}
            </Button>
          ) : null}
          <ConfirmDialog
            open={confirmPush}
            onOpenChange={setConfirmPush}
            title={`Create ${unpushed} items in ${TOOL_LABEL[backlog.target]}?`}
            description={`They go into project ${backlog.project}, each with a trace link back to ${brd.id} v${backlog.brdVersion}. Items already created are skipped.`}
            confirmLabel={`Create ${unpushed} items`}
            busy={push.isPending}
            onConfirm={() => {
              setConfirmPush(false);
              push.mutate({ id: backlog.id });
            }}
          >
            <dl className="border-line text-caption mt-1 grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border p-3">
              {(Object.keys(types) as BacklogType[]).map((t) => {
                const n = items.filter((i) => i.type === t && !i.external).length;
                return (
                  <div key={t} className="contents">
                    <dt className="text-muted">
                      {n} {TYPE[t].label.toLowerCase().replace(/y$/, n === 1 ? "y" : "ie")}
                      {n === 1 ? "" : "s"}
                    </dt>
                    <dd className="text-foreground">→ {types[t]}</dd>
                  </div>
                );
              })}
            </dl>
          </ConfirmDialog>
        </div>
      </header>
      <ErrorNote error={push.error ?? generate.error} />

      <div className="border-line flex flex-wrap items-center gap-2 border-b px-4 py-2">
        <div
          role="tablist"
          aria-label="Backlog views"
          className="border-line bg-surface flex rounded-md border p-0.5"
        >
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "text-caption cursor-pointer rounded-xs px-2.5 py-1 font-semibold",
                view === v.id ? "bg-agent text-agent-ink" : "text-muted hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        {view === "tree" ? (
          <>
            <label className="border-line bg-surface focus-within:border-agent flex h-8 min-w-48 flex-1 items-center gap-1.5 rounded-md border px-2 @5xl:max-w-xs">
              <Search className="text-muted size-3.5" aria-hidden />
              <span className="sr-only">Filter the backlog</span>
              <input
                type="search"
                value={filter.q}
                onChange={(e) => setFilter({ ...filter, q: e.target.value })}
                placeholder="Filter by title, id, BR-…, label"
                className="text-caption text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            <Select
              label="Release"
              prefix="Release"
              variant="toolbar"
              size="sm"
              value={filter.release}
              onValueChange={(release) => setFilter({ ...filter, release })}
              options={[
                { value: "all", label: "All", meta: String(stories.length) },
                ...releases.map((r) => ({
                  value: r,
                  label: r,
                  dot: (r === "MVP" ? "agent" : "neutral") as Tone,
                  description: (() => {
                    const n = plan.filter((p) => p.release === r).length;
                    const pts = stories
                      .filter((x) => x.release === r)
                      .reduce((a, x) => a + (x.points ?? 0), 0);
                    return `${n} sprint${n === 1 ? "" : "s"} · ${pts} pts`;
                  })(),
                  meta: String(stories.filter((x) => x.release === r).length),
                })),
              ]}
            />
            <Select
              label="Kind"
              prefix="Kind"
              variant="toolbar"
              size="sm"
              value={filter.kind}
              onValueChange={(kind) => setFilter({ ...filter, kind })}
              options={[
                { value: "all" as const, label: "All", meta: String(stories.length) },
                ...kinds.map((k) => ({
                  value: k,
                  label: BACKLOG_KIND_LABEL[k],
                  dot: KIND_TONE[k],
                  description: KIND_HINT[k],
                  meta: String(stories.filter((x) => x.kind === k).length),
                })),
              ]}
            />
            <button
              type="button"
              aria-pressed={filter.notReady}
              onClick={() => setFilter({ ...filter, notReady: !filter.notReady })}
              className={cn(
                "text-caption flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5",
                filter.notReady
                  ? "border-gate-line bg-gate-wash text-gate-fg"
                  : "border-line bg-surface text-muted hover:text-foreground hover:border-line-strong",
              )}
            >
              <TriangleAlert className="size-3.5" aria-hidden /> Not ready
              <span className="text-micro font-mono">{stories.length - ready}</span>
            </button>
            <span className="ml-auto flex gap-1">
              <Tooltip content="Expand all">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Expand all"
                  onClick={() => setOpen(new Set(expandable.map((i) => i.id)))}
                >
                  <ChevronsUpDown className="size-4" />
                </Button>
              </Tooltip>
              <Tooltip content="Collapse all">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Collapse all"
                  onClick={() => setOpen(new Set())}
                >
                  <ChevronsDownUp className="size-4" />
                </Button>
              </Tooltip>
            </span>
          </>
        ) : null}
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="@container min-h-0 min-w-0 flex-1 overflow-auto">
          {view === "tree" ? (
            <BacklogTree
              backlog={backlog}
              ix={ix}
              open={open}
              onToggle={(id) =>
                setOpen((s) => {
                  const n = new Set(s);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
              visible={visible}
              selected={selected}
              onSelect={setSelected}
            />
          ) : view === "plan" ? (
            <SprintPlan items={items} ix={ix} onSelect={setSelected} />
          ) : view === "trace" ? (
            <Traceability brd={brd} items={items} ix={ix} onSelect={setSelected} />
          ) : (
            <Readiness items={items} onSelect={setSelected} />
          )}
        </div>
        {item ? (
          <aside
            aria-label={`${TYPE[item.type].label} ${item.id} details`}
            className="border-line bg-surface @max-4xl:shadow-raise w-md shrink-0 overflow-y-auto border-l @max-4xl:absolute @max-4xl:inset-y-0 @max-4xl:right-0 @max-4xl:z-20 @max-4xl:w-full @max-4xl:max-w-md"
          >
            <ItemDetail
              key={`${item.id}-${JSON.stringify(item)}`}
              brd={brd}
              backlog={backlog}
              ix={ix}
              item={item}
              onSelect={(id) => {
                setSelected(id);
                const target = ix.byId.get(id);
                if (target)
                  setOpen((s) => {
                    const n = new Set(s);
                    let p = target.parentId;
                    while (p) {
                      n.add(p);
                      p = ix.byId.get(p)?.parentId ?? null;
                    }
                    return n;
                  });
              }}
              onClose={() => setSelected(null)}
            />
          </aside>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">
        {item ? `${item.id} selected, ${rollup(ix, item).points} points` : ""}
      </span>
    </div>
  );
}
