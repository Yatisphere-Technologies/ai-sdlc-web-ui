import {
  BRD_STATUS_LABEL,
  type Brd,
  type BrdCheck,
  type BusinessRequirement,
  MOSCOW_LABEL,
} from "@throughline/contracts";
import { Badge, cn } from "@throughline/ui";
import { CircleAlert, Plus, Quote, Sparkles, Trash2, TriangleAlert, X } from "lucide-react";
import { MOSCOW_OPTIONS, type Section } from "../brd/sections";
import { InlineSelect, InlineText } from "./inline";
import type { LocalDoc } from "./useDocument";

type Update = (fn: (d: LocalDoc) => LocalDoc) => void;

export const GENERIC_ACTIONS = [
  { id: "review", label: "Review this section", prompt: "Review this section" },
  { id: "concise", label: "Make it concise", prompt: "Make this concise" },
];
const TEXT_ACTIONS = [
  { id: "concise", label: "Make it concise", prompt: "Make this concise" },
  { id: "measurable", label: "Make it measurable", prompt: "Make this measurable" },
  { id: "formal", label: "More formal", prompt: "Make this more formal" },
  { id: "grammar", label: "Fix grammar", prompt: "Fix the grammar" },
  { id: "review", label: "Review this section", prompt: "Review this section" },
];
/** Quick agent requests offered on each section's menu. */
export const SECTION_ACTIONS: Record<string, { id: string; label: string; prompt: string }[]> = {
  summary: TEXT_ACTIONS,
  problem: TEXT_ACTIONS,
  background: TEXT_ACTIONS,
  requirements: [
    { id: "testable", label: "Make every requirement testable", prompt: "Make every requirement testable" },
    { id: "review", label: "Review this section", prompt: "Review this section" },
  ],
  objectives: [{ id: "review", label: "Review the objectives", prompt: "Review this section" }],
  scope: [{ id: "review", label: "Review the scope", prompt: "Review this section" }],
  stakeholders: [{ id: "review", label: "Who's missing?", prompt: "Review this section" }],
};
type Row = Record<string, unknown>;

const PRIORITY_TONE = { must: "risk", should: "gate", could: "ion", wont: "neutral" } as const;

export function Issues({ checks }: { checks: BrdCheck[] }) {
  if (!checks.length) return null;
  return (
    <ul className="flex flex-col gap-0.5">
      {checks.map((c) => (
        <li
          key={c.id}
          className={cn(
            "text-caption flex items-start gap-1.5",
            c.severity === "error" ? "text-risk-fg" : "text-gate-fg",
          )}
        >
          {c.severity === "error" ? (
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-label="Blocking" />
          ) : (
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-label="Warning" />
          )}
          {c.message}
        </li>
      ))}
    </ul>
  );
}

export function Cites({ ids, onCite }: { ids?: string[]; onCite: (id: string) => void }) {
  if (!ids?.length) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Quote className="text-ion size-3" aria-hidden />
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onCite(id)}
          className="bg-ion-soft text-nano text-ion-fg cursor-pointer rounded-sm px-1.5 font-mono hover:underline"
          title={`Show ${id} in sources`}
        >
          {id}
        </button>
      ))}
    </span>
  );
}

function StringList({
  items,
  onChange,
  readOnly,
  label,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  readOnly: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <ul className="flex flex-col gap-0.5">
        {items.map((x, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: items are edited in place
          <li key={i} className="group text-body text-subtle flex items-start gap-2">
            <span className="bg-ghost mt-2.5 size-1.5 shrink-0 rounded-full" aria-hidden />
            <InlineText
              value={x}
              readOnly={readOnly}
              label={`${label} ${i + 1}`}
              onChange={(v) => onChange(items.map((y, j) => (j === i ? v : y)))}
            />
            {!readOnly ? (
              <button
                type="button"
                aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-ghost hover:text-risk mt-1 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {readOnly && items.length === 0 ? (
        <span className="text-body-sm text-ghost italic">None listed.</span>
      ) : null}
      {!readOnly ? (
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="text-caption text-muted hover:text-agent-fg flex w-fit cursor-pointer items-center gap-1"
        >
          <Plus className="size-3.5" aria-hidden /> Add
        </button>
      ) : null}
    </div>
  );
}

export function RequirementCard({
  r,
  objectives,
  readOnly,
  onChange,
  onRemove,
  checks,
  onCite,
  onAsk,
}: {
  r: BusinessRequirement;
  objectives: string[];
  readOnly: boolean;
  onChange: (r: BusinessRequirement) => void;
  onRemove: () => void;
  checks: BrdCheck[];
  onCite: (id: string) => void;
  onAsk?: (text: string) => void;
}) {
  const set = <K extends keyof BusinessRequirement>(k: K, v: BusinessRequirement[K]) =>
    onChange({ ...r, [k]: v });
  return (
    <article
      id={`brd-${r.id}`}
      className={cn(
        "group bg-surface-sunken flex scroll-mt-24 flex-col gap-2 rounded-xl border p-4",
        checks.some((c) => c.severity === "error") ? "border-risk-line" : "border-line",
      )}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-micro text-agent-fg font-mono">{r.id}</span>
        <InlineText
          value={r.title}
          onChange={(v) => set("title", v)}
          readOnly={readOnly}
          multiline={false}
          label={`${r.id} title`}
          className="text-body text-strong min-w-48 flex-1 font-semibold"
        />
        <InlineSelect
          value={r.priority}
          options={MOSCOW_OPTIONS}
          onChange={(v) => set("priority", v as BusinessRequirement["priority"])}
          readOnly={readOnly}
          label={`${r.id} priority`}
          className="text-micro font-mono uppercase"
          render={(v) => (
            <Badge tone={PRIORITY_TONE[v as BusinessRequirement["priority"]]} mono>
              {MOSCOW_LABEL[v as BusinessRequirement["priority"]]}
            </Badge>
          )}
        />
        {!readOnly && onAsk ? (
          <button
            type="button"
            onClick={() => onAsk(`Refine ${r.id}`)}
            className="text-caption text-agent-fg hover:bg-agent-wash flex cursor-pointer items-center gap-1 rounded-xs px-1.5 py-0.5 opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Sparkles className="size-3.5" aria-hidden /> Review with agent
          </button>
        ) : null}
        {!readOnly ? (
          <button
            type="button"
            aria-label={`Remove ${r.id}`}
            onClick={onRemove}
            className="text-ghost hover:text-risk cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </header>
      <InlineText
        value={r.statement}
        onChange={(v) => set("statement", v)}
        readOnly={readOnly}
        label={`${r.id} requirement`}
        placeholder="The system shall…"
        className="text-body text-foreground"
      />
      <div className="text-body-sm text-subtle flex gap-1.5">
        <span className="text-muted shrink-0 pt-0.5">Why:</span>
        <InlineText
          value={r.rationale}
          onChange={(v) => set("rationale", v)}
          readOnly={readOnly}
          label={`${r.id} rationale`}
          placeholder="Why this matters"
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className="eyebrow text-muted">Acceptance criteria</span>
        <StringList
          items={r.acceptance}
          onChange={(v) => set("acceptance", v)}
          readOnly={readOnly}
          label={`${r.id} criterion`}
        />
      </div>
      <dl className="text-caption grid gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Actor", "actor"],
            ["Area (epic)", "area"],
            ["Source", "source"],
          ] as const
        ).map(([labelText, key]) => (
          <div key={key} className="flex min-w-0 flex-col">
            <dt className="text-muted">{labelText}</dt>
            <dd className="text-subtle">
              <InlineText
                value={r[key]}
                onChange={(v) => set(key, v)}
                readOnly={readOnly}
                multiline={false}
                label={`${r.id} ${labelText}`}
              />
            </dd>
          </div>
        ))}
        <div className="flex flex-col">
          <dt className="text-muted">Objective</dt>
          <dd className="text-subtle">
            <InlineSelect
              value={r.objective}
              options={[
                { value: "", label: "Not linked" },
                ...objectives.map((o) => ({ value: o, label: o })),
              ]}
              onChange={(v) => set("objective", v)}
              readOnly={readOnly}
              label={`${r.id} objective`}
            />
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Cites ids={r.sources} onCite={onCite} />
      </div>
      <Issues checks={checks} />
    </article>
  );
}

/** One structured item (objective, risk, stakeholder…) with its fields edited in place. */
export function RowCard({
  section,
  row,
  readOnly,
  onChange,
  onRemove,
  checks,
  onCite,
}: {
  section: Extract<Section, { kind: "rows" }>;
  row: Row;
  readOnly: boolean;
  onChange: (row: Row) => void;
  onRemove: () => void;
  checks: BrdCheck[];
  onCite: (id: string) => void;
}) {
  const span = { 1: "sm:col-span-1", 2: "sm:col-span-2", 3: "sm:col-span-3", 6: "sm:col-span-6" } as const;
  const name = String(row.id ?? row.name ?? row.term ?? row.entity ?? section.title);
  const rowChecks = checks.filter((c) => c.target !== null && c.target === row.id);
  return (
    <div className="group border-line bg-surface-sunken relative grid gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 sm:grid-cols-6">
      {section.fields.map((f) => (
        <div key={f.key} className={cn("flex min-w-0 flex-col", span[f.span ?? 6])}>
          <span className="eyebrow text-faint">{f.label}</span>
          {f.kind === "select" ? (
            <InlineSelect
              value={String(row[f.key] ?? "")}
              options={f.options ?? []}
              onChange={(v) => onChange({ ...row, [f.key]: v })}
              readOnly={readOnly}
              label={`${name} ${f.label}`}
              className="text-body-sm text-foreground"
            />
          ) : (
            <InlineText
              value={
                Array.isArray(row[f.key]) ? (row[f.key] as string[]).join("\n") : String(row[f.key] ?? "")
              }
              onChange={(v) => onChange({ ...row, [f.key]: f.kind === "lines" ? v.split("\n") : v })}
              readOnly={readOnly}
              multiline={f.key !== "id"}
              label={`${name} ${f.label}`}
              className={cn("text-body-sm", f.key === "id" ? "text-agent-fg font-mono" : "text-foreground")}
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
        <Cites ids={row.sources as string[] | undefined} onCite={onCite} />
        <Issues checks={rowChecks} />
      </div>
      {!readOnly ? (
        <button
          type="button"
          aria-label={`Remove ${name}`}
          onClick={onRemove}
          className="text-ghost hover:text-risk absolute top-2 right-2 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/** Title, metadata and approvers at the top of the document. */
export function DocumentHeader({
  brd,
  doc,
  update,
  readOnly,
}: {
  brd: Brd;
  doc: LocalDoc;
  update: Update;
  readOnly: boolean;
}) {
  return (
    <header className="border-line flex flex-col gap-4 border-b pb-8">
      <div className="text-micro text-muted flex flex-wrap items-center gap-2 font-mono">
        <span className="text-agent-fg">{brd.id}</span>·<span>Business requirements document</span>·
        <span>v{brd.version}</span>·<span>{BRD_STATUS_LABEL[brd.status]}</span>
      </div>
      <InlineText
        value={doc.title}
        onChange={(v) => update((d) => ({ ...d, title: v }))}
        readOnly={readOnly}
        label="Document title"
        className="font-display text-display-md text-strong"
      />
      <dl className="text-body-sm grid gap-x-6 gap-y-2 sm:grid-cols-3">
        <div>
          <dt className="eyebrow text-muted">Owner</dt>
          <dd>
            <InlineText
              value={doc.owner}
              onChange={(v) => update((d) => ({ ...d, owner: v }))}
              readOnly={readOnly}
              multiline={false}
              label="Owner"
              className="text-foreground"
            />
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-muted">Work item</dt>
          <dd>
            <InlineText
              value={doc.workItemKey}
              onChange={(v) => update((d) => ({ ...d, workItemKey: v }))}
              readOnly={readOnly}
              multiline={false}
              label="Work item"
              placeholder="e.g. INT-36"
              className="text-foreground font-mono"
            />
          </dd>
        </div>
        <div>
          <dt className="eyebrow text-muted">Author</dt>
          <dd className="text-subtle px-0 py-0.5">{brd.author}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Approvers</span>
        <ul className="flex flex-col gap-1">
          {doc.approvals.map((a, i) => {
            const live = brd.approvals.find((x) => x.id === a.id);
            return (
              <li
                key={a.id}
                className="group text-body-sm grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-center gap-3"
              >
                <InlineText
                  value={a.capacity}
                  onChange={(v) =>
                    update((d) => ({
                      ...d,
                      approvals: d.approvals.map((x, j) => (j === i ? { ...x, capacity: v } : x)),
                    }))
                  }
                  readOnly={readOnly}
                  multiline={false}
                  label={`Approver ${i + 1} capacity`}
                  className="text-muted"
                />
                <InlineText
                  value={a.name}
                  onChange={(v) =>
                    update((d) => ({
                      ...d,
                      approvals: d.approvals.map((x, j) => (j === i ? { ...x, name: v } : x)),
                    }))
                  }
                  readOnly={readOnly}
                  multiline={false}
                  label={`Approver ${i + 1} name`}
                  className="text-foreground"
                />
                <Badge
                  tone={
                    live?.status === "approved"
                      ? "ok"
                      : live?.status === "changes-requested"
                        ? "risk"
                        : "neutral"
                  }
                  mono
                >
                  {live?.status ?? "pending"}
                </Badge>
                {!readOnly && doc.approvals.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove approver ${a.name}`}
                    onClick={() =>
                      update((d) => ({ ...d, approvals: d.approvals.filter((_, j) => j !== i) }))
                    }
                    className="text-ghost hover:text-risk cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  >
                    <X className="size-4" />
                  </button>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ul>
        {!readOnly ? (
          <button
            type="button"
            onClick={() =>
              update((d) => ({
                ...d,
                approvals: [
                  ...d.approvals,
                  { id: `ap-${Date.now().toString(36)}`, capacity: "Approver", name: "To be assigned" },
                ],
              }))
            }
            className="text-caption text-muted hover:text-agent-fg flex w-fit cursor-pointer items-center gap-1"
          >
            <Plus className="size-3.5" aria-hidden /> Add approver
          </button>
        ) : null}
      </div>
    </header>
  );
}
