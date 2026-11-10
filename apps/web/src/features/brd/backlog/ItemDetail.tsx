import {
  type Backlog,
  type BacklogItem,
  type Brd,
  DEFINITION_OF_DONE,
  type IssuePriority,
  POINTS,
  storyChecks,
  TASK_KIND_LABEL,
} from "@throughline/contracts";
import { Badge, Button, cn, Select } from "@throughline/ui";
import {
  ArrowRight,
  ChevronRight,
  CircleCheck,
  Clock,
  Database,
  Link2,
  ListChecks,
  ShieldAlert,
  Target,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { usePatchItem } from "../api";
import { ancestors, type Index, rollup, traceText } from "./meta";
import { INPUT, KindBadge, PRIORITY, Section, TraceChip, TYPE } from "./parts";

const PRIORITY_HINT: Record<IssuePriority, string> = {
  highest: "Must have · MVP",
  high: "Should have",
  medium: "Could have",
  low: "Nice to have",
};
const POINT_HINT: Record<number, string> = {
  1: "Trivial change",
  2: "Small, well understood",
  3: "Small with some unknowns",
  5: "Medium",
  8: "Large; largest allowed in a sprint",
  13: "Too big: split before planning",
};

const TEST_TONE = { happy: "ok", negative: "risk", edge: "gate", nfr: "ion" } as const;
const CLASS_TONE = { public: "neutral", internal: "ion", confidential: "gate", restricted: "risk" } as const;

/**
 * Everything a delivery team needs about one backlog item: value, scope, criteria, tests, done,
 * traceability to the BRD, data, risks, dependencies and children. Priority, points, title and
 * criteria are editable for people who can create work.
 */
export function ItemDetail({
  brd,
  backlog,
  ix,
  item,
  onSelect,
  onClose,
}: {
  brd: Brd;
  backlog: Backlog;
  ix: Index;
  item: BacklogItem;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { can } = useTenant();
  const patch = usePatchItem();
  const editable = can("work.create");
  const [title, setTitle] = useState(item.title);
  const [points, setPoints] = useState<number | null>(item.points);
  const [priority, setPriority] = useState<IssuePriority>(item.priority);
  const [criteria, setCriteria] = useState(item.acceptance);
  const [showTeamDod, setShowTeamDod] = useState(false);
  const checks = storyChecks({ ...item, points, acceptance: criteria });
  const dirty =
    title !== item.title ||
    points !== item.points ||
    priority !== item.priority ||
    JSON.stringify(criteria) !== JSON.stringify(item.acceptance);
  const T = TYPE[item.type];
  const path = ancestors(ix, item);
  const children = ix.children.get(item.id) ?? [];
  const totals = rollup(ix, item);
  const blocks = ix.blocks.get(item.id) ?? [];
  const c = brd.content;
  const link = (id: string) => {
    const it = ix.byId.get(id);
    return it ? (
      <button
        type="button"
        key={id}
        onClick={() => onSelect(id)}
        className="hover:bg-surface-raised flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left"
      >
        <span className="text-micro text-faint font-mono">{id}</span>
        <span className="text-body-sm text-foreground min-w-0 flex-1 truncate">{it.title}</span>
        {it.iteration ? <span className="text-caption text-muted">{it.iteration}</span> : null}
      </button>
    ) : null;
  };

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="text-micro text-muted flex flex-wrap items-center gap-2 font-mono">
            <T.Icon className={cn("size-4", T.color)} aria-hidden /> {T.label} · {item.id}
            <KindBadge kind={item.kind} />
            {item.release ? (
              <Badge tone="neutral" mono>
                {item.release}
              </Badge>
            ) : null}
            {item.external ? (
              <Badge tone="ok" mono>
                {item.external.key}
              </Badge>
            ) : null}
          </span>
          {path.length ? (
            <nav aria-label="Parents" className="text-caption text-muted flex flex-wrap items-center gap-1">
              {path.map((p, n) => (
                <span key={p.id} className="flex items-center gap-1">
                  {n > 0 ? <ChevronRight className="text-ghost size-3" aria-hidden /> : null}
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className="hover:text-foreground cursor-pointer hover:underline"
                  >
                    {p.title}
                  </button>
                </span>
              ))}
            </nav>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close details"
          onClick={onClose}
          className="text-muted hover:bg-surface-raised hover:text-foreground grid size-8 shrink-0 cursor-pointer place-items-center rounded-md"
        >
          <X className="size-4" />
        </button>
      </div>

      {editable && item.type !== "subtask" ? (
        <input
          aria-label="Title"
          className={cn(INPUT, "text-body font-semibold")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      ) : (
        <h3 className="text-body-lg text-strong font-semibold">{item.title}</h3>
      )}

      {item.story ? (
        <p className="border-agent-line bg-agent-wash text-body-sm text-subtle rounded-md border px-3 py-2.5">
          <span className="text-muted">As a </span>
          <span className="text-foreground font-medium">{item.story.asA}</span>
          <span className="text-muted">, I want </span>
          {item.story.iWant}
          <span className="text-muted">, so that </span>
          {item.story.soThat}.
        </p>
      ) : item.description ? (
        <p className="text-body-sm text-subtle whitespace-pre-line">{item.description}</p>
      ) : null}

      {item.businessValue ? (
        <Section title="Business value">
          <p className="border-line bg-surface-raised text-body-sm text-foreground rounded-md border px-3 py-2.5">
            {item.businessValue}
          </p>
        </Section>
      ) : null}

      {item.outcomes.length ? (
        <Section title="Outcomes" count={item.outcomes.length}>
          <ul className="flex flex-col gap-1.5">
            {item.outcomes.map((o) => (
              <li
                key={o.objective}
                className="border-line flex items-start gap-2 rounded-md border px-3 py-2"
              >
                <Target className="text-human-fg mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-sm text-foreground">
                    <span className="text-micro text-human-fg font-mono">{o.objective}</span> {o.kpi}
                  </span>
                  <span className="text-caption text-muted flex flex-wrap items-center gap-1.5">
                    {o.baseline} <ArrowRight className="size-3" aria-hidden />
                    <span className="text-ok">{o.target}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.scope ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Section title="In scope" count={item.scope.in.length}>
            <ul className="text-body-sm text-subtle flex list-disc flex-col gap-1 pl-4">
              {item.scope.in.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </Section>
          {item.scope.out.length ? (
            <Section title="Out of scope" count={item.scope.out.length}>
              <ul className="text-body-sm text-muted flex list-disc flex-col gap-1 pl-4">
                {item.scope.out.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
      ) : null}

      {item.criteria.length ? (
        <Section
          title={item.type === "epic" ? "Done when" : "Business acceptance criteria"}
          count={item.criteria.length}
        >
          <ul className="flex flex-col gap-1">
            {item.criteria.map((x) => (
              <li key={x} className="text-body-sm text-subtle flex items-start gap-2">
                <CircleCheck className="text-ok mt-0.5 size-3.5 shrink-0" aria-hidden /> {x}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <dl className="border-line grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3">
        <div className="flex flex-col gap-1">
          <dt className="eyebrow text-muted">Priority</dt>
          <dd>
            {editable && item.type !== "subtask" ? (
              <Select
                label="Priority"
                size="sm"
                className="w-full"
                value={priority}
                onValueChange={setPriority}
                options={(Object.keys(PRIORITY) as IssuePriority[]).map((p) => ({
                  value: p,
                  label: PRIORITY[p].label,
                  dot: PRIORITY[p].tone,
                  description: PRIORITY_HINT[p],
                }))}
              />
            ) : (
              <Badge tone={PRIORITY[item.priority].tone} mono>
                {PRIORITY[item.priority].label}
              </Badge>
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow text-muted">{item.type === "subtask" ? "Estimate" : "Story points"}</dt>
          <dd className="text-body-sm text-foreground">
            {item.type === "story" && editable ? (
              <Select
                label="Story points"
                size="sm"
                className="w-full"
                value={points === null ? "" : String(points)}
                onValueChange={(v) => setPoints(v === "" ? null : Number(v))}
                options={[
                  { value: "", label: "Not estimated" },
                  ...POINTS.map((p) => ({
                    value: String(p),
                    label: `${p} ${p === 1 ? "point" : "points"}`,
                    description: POINT_HINT[p],
                    meta: `~${p * 6}h`,
                    disabled: p > 8,
                  })),
                ]}
              />
            ) : item.type === "subtask" ? (
              `${item.hours ?? "–"} h`
            ) : (
              `${totals.points} pts`
            )}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow text-muted">Effort</dt>
          <dd className="text-body-sm text-foreground flex flex-wrap items-center gap-x-1.5">
            <Clock className="text-muted size-3.5" aria-hidden />
            <span className="whitespace-nowrap">{totals.hours} h</span>
            {item.type !== "story" && item.type !== "subtask" ? (
              <span className="text-muted whitespace-nowrap">· {totals.stories} stories</span>
            ) : null}
          </dd>
        </div>
        {item.iteration ? (
          <div className="flex flex-col gap-1">
            <dt className="eyebrow text-muted">Sprint</dt>
            <dd className="text-body-sm text-foreground">{item.iteration}</dd>
          </div>
        ) : null}
        {item.owner ? (
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="eyebrow text-muted">Owner</dt>
            <dd className="text-body-sm text-foreground">{item.owner}</dd>
          </div>
        ) : null}
        {item.taskKind ? (
          <div className="flex flex-col gap-1">
            <dt className="eyebrow text-muted">Discipline</dt>
            <dd className="text-body-sm text-foreground">{TASK_KIND_LABEL[item.taskKind]}</dd>
          </div>
        ) : null}
        {item.components.length ? (
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="eyebrow text-muted">Components</dt>
            <dd className="flex flex-wrap gap-1">
              {item.components.map((x) => (
                <Badge key={x} tone="neutral">
                  {x}
                </Badge>
              ))}
            </dd>
          </div>
        ) : null}
        {item.labels.length ? (
          <div className="col-span-2 flex flex-col gap-1">
            <dt className="eyebrow text-muted">Labels</dt>
            <dd className="text-caption text-subtle">{item.labels.join(" · ")}</dd>
          </div>
        ) : null}
      </dl>

      {item.type === "story" ? (
        <Section title="Acceptance criteria (Given / When / Then)" count={criteria.length}>
          {criteria.map((cr, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: criteria have no ids and are edited in place
              key={`${item.id}-ac-${i}`}
              className="border-line bg-surface-sunken grid gap-1.5 rounded-md border p-2.5"
            >
              {(["given", "when", "then"] as const).map((k) => (
                <div key={k} className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2">
                  <span className="text-micro text-agent-fg font-mono uppercase">{k}</span>
                  {editable ? (
                    <input
                      aria-label={`Criterion ${i + 1} ${k}`}
                      className={INPUT}
                      value={cr[k]}
                      onChange={(e) =>
                        setCriteria(criteria.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))
                      }
                    />
                  ) : (
                    <span className="text-body-sm text-subtle">{cr[k]}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {editable ? (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() =>
                // biome-ignore lint/suspicious/noThenProperty: Given/When/Then criterion, never awaited
                setCriteria([...criteria, { given: "", when: "", then: "" }])
              }
            >
              + Add criterion
            </Button>
          ) : null}
        </Section>
      ) : null}

      {item.tests.length ? (
        <Section title="Test scenarios" count={item.tests.length}>
          <ul className="flex flex-col gap-1.5">
            {item.tests.map((t) => (
              <li key={t.scenario} className="text-body-sm text-subtle flex items-start gap-2">
                <Badge tone={TEST_TONE[t.kind]} mono className="mt-0.5 shrink-0">
                  {t.kind}
                </Badge>
                <span>{t.scenario}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.type === "story" ? (
        <Section title="Definition of done">
          <ul className="flex flex-col gap-1">
            {item.definitionOfDone.map((d) => (
              <li key={d} className="text-body-sm text-foreground flex items-start gap-2">
                <ListChecks className="text-agent mt-0.5 size-3.5 shrink-0" aria-hidden /> {d}
              </li>
            ))}
            <li>
              <button
                type="button"
                aria-expanded={showTeamDod}
                onClick={() => setShowTeamDod((v) => !v)}
                className="text-caption text-muted hover:text-foreground cursor-pointer"
              >
                {showTeamDod ? "Hide" : "Plus"} the team's definition of done ({DEFINITION_OF_DONE.length})
              </button>
            </li>
            {showTeamDod
              ? DEFINITION_OF_DONE.map((d) => (
                  <li key={d} className="text-caption text-muted flex items-start gap-2 pl-5">
                    · {d}
                  </li>
                ))
              : null}
          </ul>
        </Section>
      ) : null}

      {item.traces.length || item.nfrs.length || item.rules.length ? (
        <Section title="Traceability to the BRD">
          <ul className="flex flex-col gap-1">
            {[...new Set([...item.traces, ...item.rules, ...item.nfrs])].map((id) => (
              <li key={id} className="flex items-start gap-2">
                <TraceChip id={id} />
                <span className="text-caption text-subtle min-w-0 pt-0.5">{traceText(c, id)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.data.length ? (
        <Section title="Data touched" count={item.data.length}>
          <ul className="flex flex-wrap gap-1.5">
            {item.data.map((d) => (
              <li
                key={d.entity}
                className="border-line flex items-center gap-1.5 rounded-md border px-2 py-1"
              >
                <Database className="text-muted size-3.5" aria-hidden />
                <span className="text-caption text-foreground">{d.entity}</span>
                <Badge tone={CLASS_TONE[d.classification as keyof typeof CLASS_TONE] ?? "neutral"} mono>
                  {d.classification}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.risks.length ? (
        <Section title="Risks" count={item.risks.length}>
          <ul className="flex flex-col gap-1.5">
            {item.risks.map((id) => {
              const r = c.risks.find((x) => x.id === id);
              return (
                <li key={id} className="text-body-sm text-subtle flex items-start gap-2">
                  <ShieldAlert className="text-risk-fg mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    <span className="text-micro text-risk-fg font-mono">{id}</span> {r?.description}
                    {r?.mitigation ? <span className="text-muted"> · Mitigation: {r.mitigation}</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      {item.dependsOn.length || blocks.length ? (
        <Section title="Dependencies">
          {item.dependsOn.length ? (
            <div className="flex flex-col">
              <span className="text-caption text-muted flex items-center gap-1.5">
                <Link2 className="size-3.5" aria-hidden /> Needs first
              </span>
              {item.dependsOn.map(link)}
            </div>
          ) : null}
          {blocks.length ? (
            <div className="flex flex-col">
              <span className="text-caption text-muted flex items-center gap-1.5">
                <Link2 className="size-3.5" aria-hidden /> Blocks
              </span>
              {blocks.map(link)}
            </div>
          ) : null}
        </Section>
      ) : null}

      {item.notes.length ? (
        <Section title="Notes">
          <ul className="text-body-sm text-subtle flex list-disc flex-col gap-1 pl-4">
            {item.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {children.length ? (
        <Section title={item.type === "story" ? "Sub-tasks" : "Contains"} count={children.length}>
          <ul className="border-line divide-line flex flex-col divide-y rounded-md border">
            {children.map((k) => (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => onSelect(k.id)}
                  className="hover:bg-surface-raised flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left"
                >
                  <span className="text-micro text-faint w-8 font-mono">{k.id}</span>
                  <span className="text-body-sm text-foreground min-w-0 flex-1 truncate">{k.title}</span>
                  {k.taskKind ? (
                    <span className="text-caption text-muted">{TASK_KIND_LABEL[k.taskKind]}</span>
                  ) : null}
                  <span className="text-micro text-subtle font-mono">
                    {k.type === "subtask" ? `${k.hours ?? "–"}h` : `${rollup(ix, k).points}pt`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {item.type === "story" ? (
        checks.length > 0 ? (
          <ul className="border-gate-line bg-gate-wash flex flex-col gap-1 rounded-md border px-3 py-2">
            {checks.map((x) => (
              <li key={x.id} className="text-caption text-gate-fg flex items-center gap-1.5">
                <TriangleAlert className="size-3.5" aria-hidden /> {x.message}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-caption text-ok flex items-center gap-1.5">
            <ListChecks className="size-3.5" aria-hidden /> Meets the definition of ready
          </p>
        )
      ) : null}

      {editable && dirty ? (
        <div className="bg-surface border-line sticky bottom-0 -mx-5 flex items-center gap-2 border-t px-5 py-3">
          <Button
            disabled={patch.isPending}
            onClick={() =>
              patch.mutate({
                backlogId: backlog.id,
                itemId: item.id,
                patch: {
                  title,
                  priority,
                  ...(item.type === "story"
                    ? { points, acceptance: criteria.filter((x) => x.then.trim()) }
                    : {}),
                },
              })
            }
          >
            Save changes
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setTitle(item.title);
              setPoints(item.points);
              setPriority(item.priority);
              setCriteria(item.acceptance);
            }}
          >
            Discard
          </Button>
        </div>
      ) : null}
      <ErrorNote error={patch.error} />
    </div>
  );
}
