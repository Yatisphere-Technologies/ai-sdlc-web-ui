import {
  TEST_LEVEL_LABEL,
  TEST_TOOL_LABEL,
  type TestCase,
  type TestLevel,
  type TestPlan,
  type TestResult,
  type TestTool,
} from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
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
  PageHeader,
  Progress,
  SegmentedControl,
  Select,
  type Tone,
} from "@throughline/ui";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  CircleSlash,
  Download,
  FlaskConical,
  Play,
  RefreshCw,
  Search,
  Send,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { download } from "@/features/architecture/export/download";
import {
  ArtifactRefLink,
  ProjectChip,
  RefChip,
  usePortfolioQuery,
  useProjectScope,
} from "@/features/projects";
import { useTenant } from "@/tenancy";
import {
  useCreateTestPlan,
  usePatchTestCase,
  usePushTestPlan,
  useRecordRun,
  useRegenerateTestPlan,
  useTestPlanDecision,
  useTestPlans,
} from "./api";
import { azureTestPlansCsv, testPlanMarkdown, xrayCsv, zephyrCsv } from "./export";

const STATUS_TONE: Record<TestPlan["status"], Tone> = {
  draft: "neutral",
  "in-review": "gate",
  approved: "ok",
  stale: "risk",
};
const STATUS_LABEL: Record<TestPlan["status"], string> = {
  draft: "Draft",
  "in-review": "In review",
  approved: "Approved",
  stale: "Out of date",
};
const RESULT: Record<
  TestResult,
  { tone: Tone; label: string; icon: typeof CheckCircle2; cell: string; text: string }
> = {
  pass: {
    tone: "ok",
    label: "Pass",
    icon: CheckCircle2,
    cell: "border-ok-line bg-ok-soft text-ok",
    text: "text-ok",
  },
  fail: {
    tone: "risk",
    label: "Fail",
    icon: XCircle,
    cell: "border-risk-line bg-risk-soft text-risk-fg",
    text: "text-risk-fg",
  },
  blocked: {
    tone: "gate",
    label: "Blocked",
    icon: CircleSlash,
    cell: "border-gate-line bg-gate-soft text-gate",
    text: "text-gate-fg",
  },
  "not-run": {
    tone: "neutral",
    label: "Not run",
    icon: CircleDashed,
    cell: "border-line text-faint",
    text: "text-muted",
  },
};
const SHORT: Record<TestLevel, string> = {
  unit: "Unit",
  contract: "Contract",
  integration: "Integ.",
  system: "System",
  e2e: "E2E",
  uat: "UAT",
  performance: "Perf.",
  security: "Security",
  resilience: "DR",
  accessibility: "A11y",
  "ai-eval": "AI eval",
  data: "Data",
};
const TOOLS: TestTool[] = ["xray", "zephyr", "azure-test-plans"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 100);
const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
    : "—";

type View = "strategy" | "cases" | "trace" | "readiness";

/* ── Header ──────────────────────────────────────────────────────────────────────────────────── */

function Coverage({ plan }: { plan: TestPlan }) {
  const c = plan.coverage;
  const items: { label: string; value: string; n: number; tone: Tone }[] = [
    {
      label: "Requirements",
      value: `${c.requirements.covered}/${c.requirements.total}`,
      n: pct(c.requirements.covered, c.requirements.total),
      tone: "agent",
    },
    {
      label: "NFRs",
      value: `${c.nfrs.covered}/${c.nfrs.total}`,
      n: pct(c.nfrs.covered, c.nfrs.total),
      tone: "agent",
    },
    {
      label: "Security controls",
      value: `${c.controls.covered}/${c.controls.total}`,
      n: pct(c.controls.covered, c.controls.total),
      tone: "agent",
    },
    { label: "Automated", value: `${c.automation}%`, n: c.automation, tone: "ion" },
    { label: "Executed", value: `${c.executed}%`, n: c.executed, tone: "ion" },
    {
      label: "Pass rate",
      value: c.passRate === null ? "—" : `${c.passRate}%`,
      n: c.passRate ?? 0,
      tone: c.passRate === null ? "neutral" : c.passRate >= 95 ? "ok" : c.passRate >= 85 ? "gate" : "risk",
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {items.map((i) => (
        <div key={i.label} className="bg-surface border-line flex flex-col gap-1.5 rounded-lg border p-3">
          <dt className="text-caption text-muted">{i.label}</dt>
          <dd className="font-display text-heading-md text-strong">{i.value}</dd>
          <Progress value={i.n} tone={i.tone === "neutral" ? "agent" : i.tone} label={i.label} />
        </div>
      ))}
    </dl>
  );
}

function Approvals({ plan }: { plan: TestPlan }) {
  const { can } = useTenant();
  const decide = useTestPlanDecision();
  return (
    <div className="flex flex-wrap gap-2">
      {plan.approvals.map((a) => (
        <span
          key={a.id}
          className={cn(
            "text-caption flex items-center gap-2 rounded-md border px-2.5 py-1.5",
            a.status === "approved"
              ? "border-ok-line bg-ok-soft text-ok"
              : "border-line bg-surface text-subtle",
          )}
        >
          {a.status === "approved" ? (
            <CheckCircle2 className="size-3.5" aria-hidden />
          ) : (
            <CircleDashed className="size-3.5" aria-hidden />
          )}
          <span>
            <span className="text-foreground font-semibold">{a.capacity}</span> · {a.name}
          </span>
          {a.status === "pending" && plan.status === "in-review" && can("work.create") ? (
            <Button
              size="sm"
              variant="gate"
              className="h-7 px-2"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: plan.id, decision: "approve", approvalId: a.id })}
            >
              Approve
            </Button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function Actions({ plan, projectName, areaPath }: { plan: TestPlan; projectName: string; areaPath: string }) {
  const { can, tenant } = useTenant();
  const regen = useRegenerateTestPlan();
  const decide = useTestPlanDecision();
  const push = usePushTestPlan();
  const run = useRecordRun();
  const [confirm, setConfirm] = useState<null | "regen" | TestTool>(null);
  const write = can("work.create");
  const slug = `${tenant.slug}-${plan.id}-v${plan.version}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {write ? (
        <Button
          variant={plan.status === "stale" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setConfirm("regen")}
        >
          <RefreshCw className="size-4" aria-hidden /> Regenerate
        </Button>
      ) : null}
      {write && plan.status === "draft" ? (
        <Button
          variant="gate"
          size="sm"
          disabled={decide.isPending}
          onClick={() => decide.mutate({ id: plan.id, decision: "submit" })}
        >
          <Send className="size-4" aria-hidden /> Submit for approval
        </Button>
      ) : null}
      {write && plan.status === "approved" ? (
        <>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <UploadCloud className="size-4" aria-hidden /> Push to test tool
                <ChevronDown className="size-3.5" aria-hidden />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>Sync cases to</MenuLabel>
              {TOOLS.map((t) => (
                <MenuItem key={t} onSelect={() => setConfirm(t)}>
                  <BrandLogo brand={t} size="xs" />
                  {TEST_TOOL_LABEL[t]}
                  {plan.target === t && plan.pushedAt ? (
                    <span className="text-caption text-muted ml-auto">synced {day(plan.pushedAt)}</span>
                  ) : null}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Button
            variant="secondary"
            size="sm"
            disabled={run.isPending}
            onClick={() => run.mutate({ id: plan.id })}
          >
            <Play className="size-4" aria-hidden /> Simulate CI run
          </Button>
        </>
      ) : null}
      <Menu>
        <MenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <Download className="size-4" aria-hidden /> Export
            <ChevronDown className="size-3.5" aria-hidden />
          </Button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuLabel>Import file for</MenuLabel>
          <MenuItem onSelect={() => download(`${slug}-xray.csv`, xrayCsv(plan), "text/csv")}>
            <BrandLogo brand="xray" size="xs" />
            Xray (CSV)
          </MenuItem>
          <MenuItem onSelect={() => download(`${slug}-zephyr-scale.csv`, zephyrCsv(plan), "text/csv")}>
            <BrandLogo brand="zephyr" size="xs" />
            Zephyr Scale (CSV)
          </MenuItem>
          <MenuItem
            onSelect={() =>
              download(`${slug}-azure-test-plans.csv`, azureTestPlansCsv(plan, areaPath), "text/csv")
            }
          >
            <BrandLogo brand="azure-test-plans" size="xs" />
            Azure Test Plans (CSV)
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onSelect={() => download(`${slug}.md`, testPlanMarkdown(plan, projectName), "text/markdown")}
          >
            Test plan document (Markdown)
          </MenuItem>
        </MenuContent>
      </Menu>
      <ConfirmDialog
        open={confirm === "regen"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Regenerate the test plan?"
        description="The QA agent rebuilds the cases from the current BRD, backlog and architecture. Cases your team authored are kept; approvals and results reset and the plan goes back to draft."
        confirmLabel="Regenerate"
        busy={regen.isPending}
        onConfirm={() => regen.mutate({ id: plan.id }, { onSettled: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm !== null && confirm !== "regen"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm && confirm !== "regen" ? `Push to ${TEST_TOOL_LABEL[confirm]}?` : ""}
        description={`${plan.cases.filter((c) => c.status !== "retired").length} cases are created or updated there, linked to their stories. Results reported by CI against those keys come back here.`}
        confirmLabel="Push"
        busy={push.isPending}
        onConfirm={() =>
          confirm &&
          confirm !== "regen" &&
          push.mutate({ id: plan.id, target: confirm }, { onSettled: () => setConfirm(null) })
        }
      />
    </div>
  );
}

function Header({ plan }: { plan: TestPlan }) {
  const project = usePortfolioQuery().data?.projects.find((p) => p.id === plan.projectId);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ProjectChip projectId={plan.projectId} />
            <Badge tone={STATUS_TONE[plan.status]}>{STATUS_LABEL[plan.status]}</Badge>
            <Badge mono>v{plan.version}</Badge>
            <span className="text-caption text-muted">
              Owner {plan.owner} ·{" "}
              <BrandLogo brand={plan.target} size="xs" className="inline-flex align-middle" />{" "}
              {TEST_TOOL_LABEL[plan.target]}
              {plan.pushedAt ? ` · synced ${day(plan.pushedAt)}` : " · not pushed"}
            </span>
          </div>
          <h2 className="font-display text-heading-lg text-strong">{plan.title}</h2>
          <div className="text-caption text-muted flex flex-wrap items-center gap-2">
            Built from
            {plan.basis.brd ? <RefChip refTo={{ type: "brd", id: plan.basis.brd.id }} /> : null}
            {plan.basis.brd ? <span className="font-mono">v{plan.basis.brd.version}</span> : null}
            {plan.basis.backlog ? <RefChip refTo={{ type: "backlog", id: plan.basis.backlog }} /> : null}
            {plan.basis.architecture ? (
              <>
                <RefChip refTo={{ type: "architecture", id: plan.basis.architecture.id }} />
                <span className="font-mono">r{plan.basis.architecture.revision}</span>
              </>
            ) : null}
            {project ? <RefChip refTo={{ type: "plan", id: `plan-${project.key.toLowerCase()}` }} /> : null}
          </div>
        </div>
        <Actions
          plan={plan}
          projectName={project?.name ?? plan.projectId}
          areaPath={project ? `${project.name}\\${project.key}` : plan.projectId}
        />
      </div>
      {plan.status === "stale" ? (
        <p className="border-risk-line bg-risk-soft text-risk-fg text-body-sm flex items-center gap-2 rounded-md border p-3">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          The BRD or architecture changed since this plan was generated. Regenerate it before running or
          pushing.
        </p>
      ) : null}
      <Approvals plan={plan} />
      <Coverage plan={plan} />
    </Card>
  );
}

/* ── Strategy ────────────────────────────────────────────────────────────────────────────────── */

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="text-body-sm w-full min-w-xl text-left">
        <thead>
          <tr className="border-line border-b">
            {head.map((h) => (
              <th key={h} scope="col" className="eyebrow text-muted py-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static rows rendered once per plan
            <tr key={i} className="border-line border-b last:border-0">
              {r.map((c, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed column order
                <td key={j} className="text-subtle py-2.5 pr-4 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{title}</CardTitle>
      {children}
    </Card>
  );
}

function StrategyView({ plan }: { plan: TestPlan }) {
  const count = (l: TestLevel) => plan.cases.filter((c) => c.level === l && c.status !== "retired").length;
  return (
    <div className="flex flex-col gap-5">
      <Section title="1 · Summary and scope">
        <p className="text-body text-subtle">{plan.summary}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="eyebrow text-ok">In scope</span>
            <ul className="text-body-sm text-subtle mt-1.5 flex list-disc flex-col gap-1 pl-5">
              {plan.scope.in.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <span className="eyebrow text-muted">Out of scope</span>
            <ul className="text-body-sm text-subtle mt-1.5 flex list-disc flex-col gap-1 pl-5">
              {plan.scope.out.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <Section title="2 · Approach by test level">
        <Table
          head={["Level", "Objective", "Owner", "Tools", "Environment", "Automation", "Cases"]}
          rows={plan.approach.map((a) => [
            <span key="l" className="text-foreground font-semibold">
              {TEST_LEVEL_LABEL[a.level]}
            </span>,
            a.objective,
            a.owner,
            a.tools.join(", "),
            a.environment,
            `${a.automationTarget}%`,
            <span key="n" className="font-mono">
              {count(a.level)}
            </span>,
          ])}
        />
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="3 · Environments">
          <Table
            head={["Name", "Purpose", "Where", "Data"]}
            rows={plan.environments.map((e) => [
              <span key="n" className="text-foreground font-semibold">
                {e.name}
              </span>,
              e.purpose,
              e.where,
              e.data,
            ])}
          />
        </Section>
        <Section title="4 · Test data">
          <Table
            head={["Entity", "Classification", "Approach"]}
            rows={plan.testData.map((d) => [d.entity, <Badge key="c">{d.classification}</Badge>, d.approach])}
          />
        </Section>
      </div>
      <Section title="5 · Product and project risks">
        <Table
          head={["ID", "Risk", "Impact", "Mitigation"]}
          rows={plan.risks.map((r) => [
            <span key="i" className="font-mono">
              {r.id}
            </span>,
            r.risk,
            r.impact,
            r.mitigation,
          ])}
        />
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="6 · Entry criteria">
          <ul className="text-body-sm text-subtle flex list-disc flex-col gap-1.5 pl-5">
            {plan.entry.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </Section>
        <Section title="7 · Schedule">
          <Table
            head={["Phase", "Start", "End", "Milestone"]}
            rows={plan.schedule.map((s) => [s.phase, day(s.start), day(s.end), s.milestone ?? ""])}
          />
        </Section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="8 · Roles">
          <Table
            head={["Role", "Name", "Responsibilities"]}
            rows={plan.roles.map((r) => [r.role, r.name, r.responsibilities])}
          />
        </Section>
        <Section title={`9 · Defects · ${plan.defects.tool}`}>
          <Table
            head={["Severity", "Meaning", "SLA"]}
            rows={plan.defects.severities.map((s) => [
              <span key="s" className="font-mono">
                {s.level}
              </span>,
              s.meaning,
              s.sla,
            ])}
          />
        </Section>
      </div>
      <Section title="History">
        <ol className="text-body-sm text-subtle flex flex-col gap-1.5">
          {[...plan.history].reverse().map((h) => (
            <li key={`${h.version}-${h.at}-${h.what}`} className="flex flex-wrap gap-2">
              <span className="font-mono">v{h.version}</span>
              <span className="text-muted">{day(h.at)}</span>
              <span>{h.what}</span>
              <span className="text-muted">· {h.by}</span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

/* ── Cases ───────────────────────────────────────────────────────────────────────────────────── */

function ResultBadge({ result }: { result: TestResult }) {
  const r = RESULT[result];
  const Icon = r.icon;
  return (
    <span className={cn("text-caption inline-flex shrink-0 items-center gap-1", r.text)}>
      <Icon className="size-3.5" aria-hidden />
      {r.label}
    </span>
  );
}

function TraceLink({ t }: { t: TestCase["traces"][number] }) {
  const cls = "text-caption font-mono";
  if (t.kind === "story" || t.kind === "work-item")
    return (
      <ArtifactRefLink refTo={{ type: "work-item", id: t.id }} className={cls}>
        {t.id}
      </ArtifactRefLink>
    );
  return <span className={cn(cls, "text-foreground")}>{t.id}</span>;
}

function CaseDetail({ plan, c }: { plan: TestPlan; c: TestCase }) {
  const { can } = useTenant();
  const patch = usePatchTestCase();
  const write = can("work.create") && plan.status !== "stale";
  return (
    <Card className="flex flex-col gap-4 xl:sticky xl:top-4">
      <div className="flex flex-col gap-1.5">
        <span className="text-micro text-muted font-mono">
          {c.id}
          {c.external ? ` · ${c.external}` : ""}
        </span>
        <h3 className="text-heading-sm text-strong font-semibold">{c.title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{TEST_LEVEL_LABEL[c.level]}</Badge>
          <Badge tone={c.priority === "P1" ? "risk" : c.priority === "P2" ? "gate" : "neutral"} mono>
            {c.priority}
          </Badge>
          <Badge tone={c.automated ? "ion" : "human"}>
            {c.automated ? `Automated · ${c.tool}` : "Manual"}
          </Badge>
          <ResultBadge result={c.result} />
        </div>
      </div>
      <p className="text-body-sm text-subtle">{c.objective}</p>
      {c.preconditions.length ? (
        <div>
          <span className="eyebrow text-muted">Preconditions</span>
          <ul className="text-body-sm text-subtle mt-1 flex list-disc flex-col gap-1 pl-5">
            {c.preconditions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {c.steps.length ? (
        <ol className="flex flex-col gap-2">
          {c.steps.map((s, i) => (
            <li
              key={`${c.id}-${s.action}`}
              className="bg-surface-raised grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md p-2.5"
            >
              <span className="text-micro text-muted row-span-2 font-mono">{i + 1}</span>
              <span className="text-body-sm text-foreground">{s.action}</span>
              <span className="text-caption text-ok">→ {s.expected}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <dl className="text-body-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="text-muted">Test data</dt>
        <dd className="text-subtle">{c.data}</dd>
        <dt className="text-muted">Risk</dt>
        <dd className="text-subtle">{c.risk}</dd>
        <dt className="text-muted">Proves</dt>
        <dd className="flex flex-wrap gap-x-2 gap-y-1">
          {c.traces.map((t) => (
            <span key={`${t.kind}-${t.id}`} title={`${t.kind}: ${t.label}`}>
              <TraceLink t={t} />
            </span>
          ))}
        </dd>
        <dt className="text-muted">Last run</dt>
        <dd className="text-subtle">{day(c.lastRunAt)}</dd>
        {c.defects.length ? (
          <>
            <dt className="text-muted">Defects</dt>
            <dd className="text-risk-fg font-mono">{c.defects.join(", ")}</dd>
          </>
        ) : null}
      </dl>
      {write ? (
        <div className="flex flex-wrap gap-2">
          {c.status !== "approved" && c.status !== "retired" ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={patch.isPending}
              onClick={() => patch.mutate({ id: plan.id, caseId: c.id, status: "ready" })}
            >
              Mark ready
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ id: plan.id, caseId: c.id, automated: !c.automated })}
          >
            {c.automated ? "Make manual" : "Mark automated"}
          </Button>
          <Button
            size="sm"
            variant={c.status === "retired" ? "secondary" : "danger"}
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate({
                id: plan.id,
                caseId: c.id,
                status: c.status === "retired" ? "draft" : "retired",
              })
            }
          >
            {c.status === "retired" ? "Restore" : "Retire"}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function CasesView({ plan }: { plan: TestPlan }) {
  const [level, setLevel] = useState<TestLevel | "all">("all");
  const [result, setResult] = useState<TestResult | "all">("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | undefined>(undefined);
  const levels = [...new Set(plan.cases.map((c) => c.level))];
  const shown = plan.cases.filter(
    (c) =>
      (level === "all" || c.level === level) &&
      (result === "all" || c.result === result) &&
      (!q ||
        `${c.id} ${c.title} ${c.traces.map((t) => t.id).join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  const active = shown.find((c) => c.id === sel) ?? shown[0];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="border-line bg-surface focus-within:border-agent flex h-9 min-w-56 flex-1 items-center gap-1.5 rounded-md border px-2.5 sm:max-w-sm">
          <Search className="text-muted size-4" aria-hidden />
          <span className="sr-only">Filter cases</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by id, title, BR-, NFR-, story…"
            className="text-body-sm text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <Select
          label="Level"
          prefix="Level"
          variant="toolbar"
          size="sm"
          value={level}
          onValueChange={setLevel}
          options={[
            { value: "all" as const, label: "All", meta: String(plan.cases.length) },
            ...levels.map((l) => ({
              value: l,
              label: TEST_LEVEL_LABEL[l],
              meta: String(plan.cases.filter((c) => c.level === l).length),
            })),
          ]}
        />
        <Select
          label="Result"
          prefix="Result"
          variant="toolbar"
          size="sm"
          value={result}
          onValueChange={setResult}
          options={[
            { value: "all" as const, label: "All" },
            ...(Object.keys(RESULT) as TestResult[]).map((r) => ({
              value: r,
              label: RESULT[r].label,
              dot: RESULT[r].tone,
              meta: String(plan.cases.filter((c) => c.result === r).length),
            })),
          ]}
        />
        <span className="text-caption text-muted">
          {shown.length} of {plan.cases.length}
        </span>
      </div>
      {active ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_28rem]">
          <Card className="p-0">
            <ul className="divide-line flex max-h-screen flex-col divide-y overflow-y-auto">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSel(c.id)}
                    aria-current={c.id === active.id}
                    className={cn(
                      "hover:bg-surface-raised grid w-full grid-cols-[5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-left",
                      c.id === active.id && "bg-agent-soft",
                      c.status === "retired" && "opacity-50",
                    )}
                  >
                    <span className="text-micro text-muted font-mono">{c.id}</span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-body-sm text-foreground truncate">{c.title}</span>
                      <span className="text-caption text-muted truncate">
                        {TEST_LEVEL_LABEL[c.level]} · {c.priority} · {c.automated ? c.tool : "Manual"} ·{" "}
                        {c.traces
                          .slice(0, 3)
                          .map((t) => t.id)
                          .join(", ")}
                      </span>
                    </span>
                    <ResultBadge result={c.result} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          <CaseDetail plan={plan} c={active} />
        </div>
      ) : (
        <EmptyState title="No cases match" />
      )}
    </div>
  );
}

/* ── Traceability ────────────────────────────────────────────────────────────────────────────── */

const SEVERITY: TestResult[] = ["fail", "blocked", "not-run", "pass"];
const TRACE_KINDS = ["requirement", "rule", "nfr", "control", "objective"] as const;
const KIND_LABEL: Record<(typeof TRACE_KINDS)[number], string> = {
  requirement: "Requirements",
  rule: "Business rules",
  nfr: "Non-functional",
  control: "Security controls",
  objective: "Objectives (UAT)",
};

function TraceView({ plan }: { plan: TestPlan }) {
  const live = plan.cases.filter((c) => c.status !== "retired");
  const levels = [...new Set(live.map((c) => c.level))];
  const rows = useMemo(() => {
    const m = new Map<
      string,
      { kind: (typeof TRACE_KINDS)[number]; id: string; label: string; cases: TestCase[] }
    >();
    for (const c of live)
      for (const t of c.traces) {
        if (!(TRACE_KINDS as readonly string[]).includes(t.kind)) continue;
        const k = `${t.kind}:${t.id}`;
        const row = m.get(k) ?? {
          kind: t.kind as (typeof TRACE_KINDS)[number],
          id: t.id,
          label: t.label,
          cases: [],
        };
        row.cases.push(c);
        m.set(k, row);
      }
    return [...m.values()].sort(
      (a, b) =>
        TRACE_KINDS.indexOf(a.kind) - TRACE_KINDS.indexOf(b.kind) ||
        a.id.localeCompare(b.id, undefined, { numeric: true }),
    );
  }, [live]);
  const cell = (cases: TestCase[]) => {
    if (!cases.length) return null;
    const worst = SEVERITY.find((s) => cases.some((c) => c.result === s)) ?? "not-run";
    return { worst, n: cases.length };
  };
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle>What each test proves</CardTitle>
        <span className="text-caption text-muted flex flex-wrap gap-3">
          {SEVERITY.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-xs border", RESULT[s].cell)} />
              {RESULT[s].label}
            </span>
          ))}
        </span>
      </CardHeader>
      <p className="text-caption text-muted">
        Rows are the BRD items, NFRs and security controls; columns are test levels. A cell counts the cases
        at that level and shows the worst latest result. {plan.coverage.requirements.covered} of{" "}
        {plan.coverage.requirements.total} Must requirements have at least one case.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-4xl border-separate border-spacing-1 text-left">
          <thead>
            <tr>
              <th scope="col" className="sr-only">
                Item
              </th>
              {levels.map((l) => (
                <th
                  key={l}
                  scope="col"
                  title={TEST_LEVEL_LABEL[l]}
                  className="text-caption text-muted px-1 text-center font-normal whitespace-nowrap"
                >
                  {SHORT[l]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TRACE_KINDS.flatMap((k) => {
              const group = rows.filter((r) => r.kind === k);
              if (!group.length) return [];
              return [
                <tr key={`h-${k}`}>
                  <th
                    scope="rowgroup"
                    colSpan={levels.length + 1}
                    className="eyebrow text-agent pt-3 pb-1 font-normal"
                  >
                    {KIND_LABEL[k]} · {group.length}
                  </th>
                </tr>,
                ...group.map((r) => (
                  <tr key={`${r.kind}-${r.id}`}>
                    <th scope="row" className="w-2/5 min-w-64 pr-3 font-normal">
                      <span className="text-agent text-caption font-mono">{r.id}</span>{" "}
                      <span className="text-body-sm text-subtle">{r.label}</span>
                    </th>
                    {levels.map((l) => {
                      const v = cell(r.cases.filter((c) => c.level === l));
                      return (
                        <td key={l} className="text-center">
                          {v ? (
                            <span
                              className={cn(
                                "text-caption inline-flex size-7 items-center justify-center rounded-sm border-2 font-mono font-bold",
                                RESULT[v.worst].cell,
                              )}
                              title={`${v.n} case(s) · ${RESULT[v.worst].label}`}
                            >
                              {v.n}
                            </span>
                          ) : (
                            <span className="text-ghost">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ── Readiness ───────────────────────────────────────────────────────────────────────────────── */

function ReadinessView({ plan }: { plan: TestPlan }) {
  const live = plan.cases.filter((c) => c.status !== "retired");
  const levels = [...new Set(live.map((c) => c.level))];
  const defects = [...new Set(live.flatMap((c) => c.defects))];
  const met = plan.exit.filter((e) => e.met).length;
  const ready = plan.exit.every((e) => e.met);
  return (
    <div className="flex flex-col gap-5">
      <Card tone={ready ? "ok" : plan.runs.length ? "gate" : undefined} className="flex flex-col gap-3">
        <CardHeader className="mb-1">
          <CardTitle>
            Exit criteria · {met} of {plan.exit.length} met
          </CardTitle>
          <Badge tone={ready ? "ok" : "gate"}>
            {ready ? "Ready to release" : plan.runs.length ? "Not ready" : "No results yet"}
          </Badge>
        </CardHeader>
        <Table
          head={["", "Criterion", "Target", "Actual"]}
          rows={plan.exit.map((e) => [
            e.met === null ? (
              <CircleDashed key="i" className="text-faint size-4" aria-label="Not measured" />
            ) : e.met ? (
              <CheckCircle2 key="i" className="text-ok size-4" aria-label="Met" />
            ) : (
              <XCircle key="i" className="text-risk size-4" aria-label="Not met" />
            ),
            <span key="c" className="text-foreground">
              <span className="text-muted font-mono">{e.id}</span> {e.criterion}
            </span>,
            e.target,
            e.actual ?? "—",
          ])}
        />
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="Results by level">
          <ul className="flex flex-col gap-3">
            {levels.map((l) => {
              const cs = live.filter((c) => c.level === l);
              const n = (r: TestResult) => cs.filter((c) => c.result === r).length;
              return (
                <li key={l} className="flex flex-col gap-1.5">
                  <span className="text-body-sm flex justify-between gap-3">
                    <span className="text-foreground">{TEST_LEVEL_LABEL[l]}</span>
                    <span className="text-caption text-muted font-mono">
                      {n("pass")}✓ {n("fail")}✗ {n("blocked")}⊘ {n("not-run")}○ / {cs.length}
                    </span>
                  </span>
                  <span className="bg-line flex h-2 w-full overflow-hidden rounded-full">
                    {(["pass", "fail", "blocked"] as const).map((r) => (
                      <span
                        key={r}
                        className={cn(r === "pass" ? "bg-ok" : r === "fail" ? "bg-risk" : "bg-gate")}
                        style={{ width: `${pct(n(r), cs.length)}%` }}
                      />
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
        <Section title={`CI runs · ${plan.runs.length}`}>
          {plan.runs.length ? (
            <Table
              head={["When", "Source", "Env", "Pass", "Fail", "Blocked", "Not run", "Time"]}
              rows={plan.runs.map((r) => [
                day(r.at),
                <span key="s" className="font-mono">
                  {r.source}
                </span>,
                r.environment,
                <span key="p" className="text-ok">
                  {r.passed}
                </span>,
                <span key="f" className="text-risk-fg">
                  {r.failed}
                </span>,
                r.blocked,
                r.notRun,
                `${r.durationMin} min`,
              ])}
            />
          ) : (
            <p className="text-body-sm text-muted">
              No results yet. Once the plan is approved and pushed, CI reports JUnit, Playwright and k6
              results against the case keys.
            </p>
          )}
          {defects.length ? (
            <p className="text-body-sm text-subtle">
              Open defects: <span className="text-risk-fg font-mono">{defects.join(", ")}</span>
            </p>
          ) : null}
        </Section>
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────────────────────── */

function Studio({ plan }: { plan: TestPlan }) {
  const [view, setView] = useState<View>("strategy");
  return (
    <div className="flex flex-col gap-5">
      <Header plan={plan} />
      <SegmentedControl
        label="View"
        value={view}
        onValueChange={setView}
        options={[
          { value: "strategy", label: "Strategy" },
          { value: "cases", label: `Cases · ${plan.cases.length}` },
          { value: "trace", label: "Traceability" },
          { value: "readiness", label: "Readiness" },
        ]}
      />
      {view === "strategy" ? <StrategyView plan={plan} /> : null}
      {view === "cases" ? <CasesView plan={plan} /> : null}
      {view === "trace" ? <TraceView plan={plan} /> : null}
      {view === "readiness" ? <ReadinessView plan={plan} /> : null}
    </div>
  );
}

function MissingPlans({ missing }: { missing: { id: string; key: string; name: string }[] }) {
  const { can } = useTenant();
  const create = useCreateTestPlan();
  if (!missing.length || !can("work.create")) return null;
  return (
    <Card tone="gate" className="flex flex-wrap items-center gap-3">
      <Bot className="text-agent size-5" aria-hidden />
      <span className="text-body-sm text-subtle flex-1">
        {missing.length === 1 ? "One project has" : `${missing.length} projects have`} no test plan yet.
      </span>
      {missing.map((p) => (
        <Button
          key={p.id}
          size="sm"
          variant="secondary"
          disabled={create.isPending}
          onClick={() => create.mutate({ projectId: p.id })}
        >
          Draft for {p.key}
        </Button>
      ))}
    </Card>
  );
}

function Plans({ selected }: { selected?: string }) {
  const { tenant } = useTenant();
  const all = useTestPlans();
  const [scope, setScope] = useProjectScope(tenant.id);
  const projects = usePortfolioQuery().data?.projects ?? [];
  const items = scope ? all.filter((p) => p.projectId === scope || p.id === selected) : all;
  const [id, setId] = useState(selected ?? items[0]?.id);
  const plan = items.find((p) => p.id === id) ?? items[0];
  const project = (pid: string) => projects.find((p) => p.id === pid);
  const missing = projects
    .filter((p) => !all.some((tp) => tp.projectId === p.id) && (!scope || p.id === scope))
    .map((p) => ({ id: p.id, key: p.key, name: p.name }));
  return (
    <div className="flex flex-col gap-4">
      <MissingPlans missing={missing} />
      {plan ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              label="Test plan"
              prefix="Test plan"
              variant="toolbar"
              size="lg"
              className="w-md max-w-full"
              value={plan.id}
              onValueChange={setId}
              options={items.map((p) => {
                const pr = project(p.projectId);
                return {
                  value: p.id,
                  label: p.title,
                  description: `${p.cases.length} cases · ${TEST_TOOL_LABEL[p.target]}`,
                  dot: STATUS_TONE[p.status],
                  group: pr ? `${pr.key} · ${pr.name}` : "Project",
                  meta: `v${p.version}`,
                };
              })}
            />
            <span className="text-caption text-muted">
              {scope
                ? `${items.length} in ${project(scope)?.key ?? "this project"} · ${all.length} in total`
                : `${all.length} test plans · ${all.reduce((n, p) => n + p.cases.length, 0)} cases`}
            </span>
          </div>
          <Studio key={plan.id} plan={plan} />
        </>
      ) : (
        <EmptyState
          icon={<FlaskConical className="size-6" aria-hidden />}
          title="No test plan in this project yet"
          description="The QA agent drafts one from the project's approved BRD, backlog and architecture."
          action={
            scope ? (
              <Button variant="secondary" onClick={() => setScope(null)}>
                Show all projects
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

export function TestingPage({ selected }: { selected?: string }) {
  const { tenant } = useTenant();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Test plan · {tenant.name}</Eyebrow>}
        title="Every requirement, a test."
        accent="Every test, a result."
      />
      <QueryBoundary>
        <Plans key={selected ?? "all"} selected={selected} />
      </QueryBoundary>
    </>
  );
}
