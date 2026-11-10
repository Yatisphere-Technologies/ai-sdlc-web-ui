import { type BrdContent, Capture, type CaptureKind } from "@throughline/contracts";
import { Button, cn, Select } from "@throughline/ui";
import { Plus, Sparkles, X } from "lucide-react";
import { type FormEvent, useId, useMemo, useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useCapture } from "./api";

/**
 * Structured entry for the guided BRD flow: one small form per kind of item, so requirements,
 * objectives, risks and the rest arrive complete and in the right shape. The agent reviews each entry
 * after it's added and proposes refinements.
 */

type Value = string | boolean | string[];
type Values = Record<string, Value>;

type Field = {
  name: string;
  label: string;
  type: "text" | "area" | "select" | "segment" | "lines";
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** Suggestions shown as a datalist (text fields). */
  suggest?: (c: BrdContent) => string[];
  wide?: boolean;
  optional?: boolean;
};

type Spec = { label: string; fields: Field[]; initial: Values; hint: string };

const opts = (...xs: [string, string][]) => xs.map(([value, label]) => ({ value, label }));
const LEVEL = opts(["high", "High"], ["medium", "Medium"], ["low", "Low"]);
const uniq = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))];
const actors = (c: BrdContent) =>
  uniq([
    ...c.requirements.map((r) => r.actor),
    ...c.stakeholders.map((s) => s.role),
    ...c.currentState.map((s) => s.actor),
  ]);

export const SPECS: Record<CaptureKind, Spec> = {
  text: {
    label: "Text",
    hint: "Replaces the section's text. Edit it later in the document.",
    initial: { target: "summary", text: "" },
    fields: [
      {
        name: "target",
        label: "Section",
        type: "segment",
        options: opts(["summary", "Summary"], ["problem", "Problem"], ["background", "Background"]),
      },
      {
        name: "text",
        label: "Text",
        type: "area",
        wide: true,
        placeholder: "Two or three sentences a sponsor can approve from.",
      },
    ],
  },
  objective: {
    label: "Objective",
    hint: "Measure, today's value and a numeric target.",
    initial: { statement: "", kpi: "", baseline: "", target: "" },
    fields: [
      {
        name: "statement",
        label: "Objective",
        type: "text",
        wide: true,
        placeholder: "Cut settlement queries",
      },
      {
        name: "kpi",
        label: "KPI (what we measure)",
        type: "text",
        placeholder: "Settlement queries a month",
      },
      { name: "baseline", label: "Today", type: "text", placeholder: "900", optional: true },
      { name: "target", label: "Target", type: "text", placeholder: "under 150" },
    ],
  },
  success: {
    label: "Success criterion",
    hint: "How we'll know it worked, 90 days after launch.",
    initial: { text: "" },
    fields: [
      {
        name: "text",
        label: "Success criterion",
        type: "text",
        wide: true,
        placeholder: "Fewer than 150 queries in the third month",
      },
    ],
  },
  scope: {
    label: "Scope item",
    hint: "One capability per entry. Saying what's out avoids surprises.",
    initial: { inScope: "in", text: "" },
    fields: [
      {
        name: "inScope",
        label: "Where",
        type: "segment",
        options: opts(["in", "In scope"], ["out", "Out of scope"]),
      },
      {
        name: "text",
        label: "Capability",
        type: "text",
        wide: true,
        placeholder: "CSV and PDF download of the daily report",
      },
    ],
  },
  stakeholder: {
    label: "Stakeholder",
    hint: "Exactly one person should be Accountable.",
    initial: { name: "", role: "", raci: "C", interest: "" },
    fields: [
      { name: "name", label: "Name", type: "text", placeholder: "Anil Kapoor" },
      { name: "role", label: "Role", type: "text", placeholder: "Head of Payments" },
      {
        name: "raci",
        label: "RACI",
        type: "segment",
        options: opts(["R", "Responsible"], ["A", "Accountable"], ["C", "Consulted"], ["I", "Informed"]),
      },
      { name: "interest", label: "What they care about", type: "text", wide: true, optional: true },
    ],
  },
  process: {
    label: "Process step",
    hint: "One step at a time, in order.",
    initial: { when: "current", actor: "", step: "" },
    fields: [
      {
        name: "when",
        label: "Process",
        type: "segment",
        options: opts(["current", "Today"], ["future", "Future"]),
      },
      { name: "actor", label: "Who", type: "text", placeholder: "Operations", suggest: actors },
      {
        name: "step",
        label: "Does what",
        type: "text",
        wide: true,
        placeholder: "Emails the settlement CSV to the merchant",
      },
    ],
  },
  pain: {
    label: "Pain point",
    hint: "Numbers make the case: time lost, errors, cost, complaints.",
    initial: { text: "" },
    fields: [
      {
        name: "text",
        label: "Pain point",
        type: "text",
        wide: true,
        placeholder: "Reports arrive 3 days late",
      },
    ],
  },
  requirement: {
    label: "Requirement",
    hint: "Who needs to do what, and why. Acceptance criteria make it testable.",
    initial: {
      actor: "",
      action: "",
      benefit: "",
      priority: "must",
      area: "",
      objective: "",
      acceptance: [""],
    },
    fields: [
      { name: "actor", label: "Who", type: "text", placeholder: "Merchant", suggest: actors },
      {
        name: "priority",
        label: "Priority",
        type: "segment",
        options: opts(["must", "Must"], ["should", "Should"], ["could", "Could"], ["wont", "Won't"]),
      },
      {
        name: "action",
        label: "shall be able to…",
        type: "text",
        wide: true,
        placeholder: "download the daily settlement report as CSV",
      },
      {
        name: "benefit",
        label: "so that… (rationale)",
        type: "text",
        wide: true,
        optional: true,
        placeholder: "they can reconcile without contacting operations",
      },
      {
        name: "area",
        label: "Capability area (epic)",
        type: "text",
        optional: true,
        suggest: (c) => uniq(c.requirements.map((r) => r.area)),
      },
      { name: "objective", label: "Serves objective", type: "select", optional: true },
      {
        name: "acceptance",
        label: "Acceptance criteria",
        type: "lines",
        wide: true,
        optional: true,
        placeholder: "The report for day D is available by 08:00 IST on D+1",
      },
    ],
  },
  rule: {
    label: "Business rule",
    hint: "A policy the solution must enforce.",
    initial: { statement: "" },
    fields: [
      {
        name: "statement",
        label: "Rule",
        type: "text",
        wide: true,
        placeholder: "Reports older than 13 months are not shown",
      },
    ],
  },
  nfr: {
    label: "Non-functional",
    hint: "Every target needs a number.",
    initial: { category: "performance", statement: "", target: "" },
    fields: [
      {
        name: "category",
        label: "Category",
        type: "select",
        options: opts(
          ["availability", "Availability"],
          ["performance", "Performance"],
          ["security", "Security"],
          ["compliance", "Compliance"],
          ["usability", "Usability"],
          ["reporting", "Reporting"],
          ["data", "Data"],
        ),
      },
      { name: "target", label: "Target", type: "text", optional: true, placeholder: "p95 under 2 seconds" },
      {
        name: "statement",
        label: "Requirement",
        type: "text",
        wide: true,
        placeholder: "Report download response time",
      },
    ],
  },
  data: {
    label: "Data item",
    hint: "Restricted data (personal, payment) needs a security requirement.",
    initial: { entity: "", description: "", classification: "internal", retention: "" },
    fields: [
      { name: "entity", label: "Entity", type: "text", placeholder: "Settlement report" },
      {
        name: "classification",
        label: "Classification",
        type: "select",
        options: opts(
          ["public", "Public"],
          ["internal", "Internal"],
          ["confidential", "Confidential"],
          ["restricted", "Restricted"],
        ),
      },
      { name: "description", label: "What it is", type: "text", wide: true, optional: true },
      { name: "retention", label: "Retention", type: "text", optional: true, placeholder: "8 years" },
    ],
  },
  risk: {
    label: "Risk",
    hint: "Approvers look for a mitigation and an owner.",
    initial: { description: "", impact: "medium", likelihood: "medium", mitigation: "", owner: "" },
    fields: [
      {
        name: "description",
        label: "Risk",
        type: "text",
        wide: true,
        placeholder: "Bank settlement file arrives late",
      },
      { name: "impact", label: "Impact", type: "segment", options: LEVEL },
      { name: "likelihood", label: "Likelihood", type: "segment", options: LEVEL },
      { name: "mitigation", label: "Mitigation", type: "text", wide: true, optional: true },
      {
        name: "owner",
        label: "Owner",
        type: "text",
        optional: true,
        suggest: (c) => c.stakeholders.map((s) => s.name),
      },
    ],
  },
  note: {
    label: "Assumption / constraint",
    hint: "What we take as given, must live with, or depend on.",
    initial: { list: "assumptions", text: "" },
    fields: [
      {
        name: "list",
        label: "Kind",
        type: "segment",
        options: opts(
          ["assumptions", "Assumption"],
          ["constraints", "Constraint"],
          ["dependencies", "Dependency"],
        ),
      },
      { name: "text", label: "Text", type: "text", wide: true },
    ],
  },
  term: {
    label: "Glossary term",
    hint: "Define anything a new reader wouldn't know.",
    initial: { term: "", definition: "" },
    fields: [
      { name: "term", label: "Term", type: "text", placeholder: "MDR" },
      {
        name: "definition",
        label: "Definition",
        type: "text",
        wide: true,
        placeholder: "Merchant discount rate",
      },
    ],
  },
  question: {
    label: "Open question",
    hint: "Approvers see open questions until they're resolved.",
    initial: { question: "", owner: "" },
    fields: [
      { name: "question", label: "Question", type: "text", wide: true },
      {
        name: "owner",
        label: "Who answers it",
        type: "text",
        optional: true,
        suggest: (c) => c.stakeholders.map((s) => s.name),
      },
    ],
  },
};

const VAGUE =
  /\b(fast|quickly|easy|easily|user-friendly|intuitive|seamless(ly)?|efficient|robust|asap|as soon as possible|appropriate|minimal)\b/i;

/** What the agent would say before you submit: shown live under the form. */
function liveHints(kind: CaptureKind, v: Values, c: BrdContent): string[] {
  const out: string[] = [];
  const s = (k: string) => String(v[k] ?? "");
  if (kind === "requirement") {
    const text = `${s("action")} ${(v.acceptance as string[]).join(" ")}`;
    const vague = text.match(VAGUE)?.[0];
    if (vague && !/\d/.test(text)) out.push(`“${vague}” isn't testable without a number.`);
    if (s("priority") === "must" && !(v.acceptance as string[]).some((a) => a.trim()))
      out.push("A Must needs acceptance criteria before approval; I'll propose some if you leave them out.");
    if (!s("benefit")) out.push("Add the “so that” so reviewers know why it matters.");
    if (/\band\b/i.test(s("action")) && s("action").length > 60)
      out.push("This may be two requirements; one action per entry.");
    if (
      c.requirements.some((r) => s("action") && r.statement.toLowerCase().includes(s("action").toLowerCase()))
    )
      out.push("A requirement with this wording already exists.");
  }
  if (kind === "objective" && s("target") && !/\d/.test(s("target"))) out.push("The target has no number.");
  if (kind === "nfr" && s("target") && !/\d/.test(s("target"))) out.push("The target has no number.");
  if (kind === "nfr" && !s("target")) out.push("Leave the target empty and I'll propose a typical one.");
  if (kind === "stakeholder" && s("raci") === "A" && c.stakeholders.some((x) => x.raci === "A"))
    out.push(
      `${c.stakeholders.find((x) => x.raci === "A")?.name} is already Accountable; normally there's one.`,
    );
  if (kind === "risk" && !s("mitigation")) out.push("No mitigation yet: approvers will flag it.");
  if (
    kind === "data" &&
    s("classification") === "restricted" &&
    !c.nfrs.some((n) => n.category === "security")
  )
    out.push("Restricted data: I'll propose a security requirement.");
  return out;
}

/** Form presets that match the agent's current question. */
function presetFor(focus: string | null): Values {
  if (!focus) return {};
  if (["summary", "problem", "background"].includes(focus)) return { target: focus };
  if (focus === "inScope" || focus === "outOfScope") return { inScope: focus === "inScope" ? "in" : "out" };
  if (focus === "currentState" || focus === "futureState")
    return { when: focus === "currentState" ? "current" : "future" };
  if (["assumptions", "constraints", "dependencies"].includes(focus)) return { list: focus };
  return {};
}

function toCapture(kind: CaptureKind, v: Values) {
  const raw: Record<string, unknown> = { kind, ...v };
  if (kind === "scope") raw.inScope = v.inScope === "in";
  if (kind === "requirement")
    raw.acceptance = (v.acceptance as string[]).map((a) => a.trim()).filter(Boolean);
  return Capture.safeParse(raw);
}

const INPUT =
  "w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-body-sm text-foreground outline-none placeholder:text-ghost focus:border-agent";

function Lines({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {value.map((line, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines are edited in place, so position is the key
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-micro text-faint w-5 shrink-0 font-mono">AC{i + 1}</span>
          <input
            id={i === 0 ? id : undefined}
            aria-label={`Acceptance criterion ${i + 1}`}
            className={INPUT}
            value={line}
            placeholder={i === 0 ? placeholder : "Another check, with a number where you can"}
            onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
          />
          {value.length > 1 ? (
            <button
              type="button"
              aria-label={`Remove criterion ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="text-ghost hover:text-risk cursor-pointer"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
      {value.length < 8 ? (
        <button
          type="button"
          onClick={() => onChange([...value, ""])}
          className="text-caption text-muted hover:text-agent-fg flex w-fit cursor-pointer items-center gap-1"
        >
          <Plus className="size-3.5" aria-hidden /> Add criterion
        </button>
      ) : null}
    </div>
  );
}

export function CaptureForm({
  brdId,
  kinds,
  kind,
  onKind,
  content,
  textTargets,
  focus,
}: {
  brdId: string;
  kinds: CaptureKind[];
  kind: CaptureKind;
  onKind: (k: CaptureKind) => void;
  content: BrdContent;
  /** Which text sections the "text" form may write in this step. */
  textTargets: string[];
  /** What the agent is asking about; presets the form to match (e.g. "Out of scope"). */
  focus?: string | null;
}) {
  const spec = SPECS[kind];
  const uid = useId();
  const firstTarget = textTargets[0];
  const preset = presetFor(focus ?? null);
  const presetKey = JSON.stringify(preset);
  const initial = useMemo(() => {
    const base: Values = {
      ...spec.initial,
      ...(kind === "text" && firstTarget ? { target: firstTarget } : {}),
    };
    for (const [k, v] of Object.entries(JSON.parse(presetKey) as Values)) if (k in base) base[k] = v;
    return base;
  }, [spec, kind, firstTarget, presetKey]);
  const [values, setValues] = useState<Values>(initial);
  const [shown, setShown] = useState(initial);
  const [tried, setTried] = useState(false);
  const capture = useCapture(brdId);
  if (shown !== initial) {
    setShown(initial);
    setValues(initial);
    setTried(false);
  }
  // On the render that resets, state still holds the previous form's values.
  const vals = shown === initial ? values : initial;
  const parsed = toCapture(kind, vals);
  const hints = liveHints(kind, vals, content);
  const missing = parsed.success ? [] : [...new Set(parsed.error.issues.map((i) => String(i.path[0])))];
  const label = (name: string) => spec.fields.find((f) => f.name === name)?.label ?? name;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!parsed.success || capture.isPending) return;
    capture.mutate(parsed.data, {
      onSuccess: () => {
        setValues(initial);
        setTried(false);
      },
    });
  };

  const fieldOptions = (f: Field) =>
    f.name === "objective"
      ? [
          { value: "", label: "Best match (agent picks)" },
          ...content.objectives.map((o) => ({ value: o.id, label: `${o.id} · ${o.statement}` })),
        ]
      : f.name === "target" && kind === "text"
        ? (f.options ?? []).filter((o) => textTargets.includes(o.value))
        : (f.options ?? []);

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-label={`Add ${spec.label.toLowerCase()}`}>
      {kinds.length > 1 ? (
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="sr-only">What to add</legend>
          {kinds.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={k === kind}
              onClick={() => onKind(k)}
              className={cn(
                "text-caption cursor-pointer rounded-xs border px-2.5 py-1",
                k === kind
                  ? "border-agent bg-agent-wash text-agent-fg"
                  : "border-line text-subtle hover:border-line-strong",
              )}
            >
              {SPECS[k].label}
            </button>
          ))}
        </fieldset>
      ) : null}
      <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2">
        {spec.fields.map((f) => {
          const id = `${uid}-${f.name}`;
          const v = vals[f.name];
          const invalid = tried && missing.includes(f.name);
          const options = fieldOptions(f);
          if (f.type === "segment" && options.length <= 1) return null;
          return (
            <div key={f.name} className={cn("flex flex-col gap-1", f.wide && "sm:col-span-2")}>
              {f.type === "segment" ? (
                <span className="text-caption text-muted" aria-hidden>
                  {f.label}
                </span>
              ) : (
                <label htmlFor={id} className="text-caption text-muted">
                  {f.label}
                  {f.optional ? <span className="text-faint"> · optional</span> : null}
                </label>
              )}
              {f.type === "segment" ? (
                <fieldset className="border-line bg-surface-sunken flex flex-wrap gap-0.5 rounded-md border p-0.5">
                  <legend className="sr-only">{f.label}</legend>
                  {options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={v === o.value}
                      onClick={() => setValues((x) => ({ ...x, [f.name]: o.value }))}
                      className={cn(
                        "text-caption flex-1 cursor-pointer rounded-xs px-2 py-1.5 font-semibold whitespace-nowrap",
                        v === o.value ? "bg-agent text-agent-ink" : "text-muted hover:text-foreground",
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </fieldset>
              ) : f.type === "select" ? (
                <Select
                  id={id}
                  label={f.label}
                  size="sm"
                  className="w-full"
                  value={String(v ?? "")}
                  onValueChange={(next) => setValues((x) => ({ ...x, [f.name]: next }))}
                  options={options}
                />
              ) : f.type === "area" ? (
                <textarea
                  id={id}
                  rows={3}
                  aria-invalid={invalid}
                  className={cn(
                    INPUT,
                    "field-sizing-content min-h-20 resize-none",
                    invalid && "border-risk-line",
                  )}
                  placeholder={f.placeholder}
                  value={String(v ?? "")}
                  onChange={(e) => setValues((x) => ({ ...x, [f.name]: e.target.value }))}
                />
              ) : f.type === "lines" ? (
                <Lines
                  id={id}
                  value={v as string[]}
                  placeholder={f.placeholder}
                  onChange={(lines) => setValues((x) => ({ ...x, [f.name]: lines }))}
                />
              ) : (
                <>
                  <input
                    id={id}
                    aria-invalid={invalid}
                    className={cn(INPUT, invalid && "border-risk-line")}
                    placeholder={f.placeholder}
                    value={String(v ?? "")}
                    list={f.suggest ? `${id}-list` : undefined}
                    onChange={(e) => setValues((x) => ({ ...x, [f.name]: e.target.value }))}
                  />
                  {f.suggest ? (
                    <datalist id={`${id}-list`}>
                      {f.suggest(content).map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              )}
            </div>
          );
        })}
      </div>
      {kind === "requirement" && String(vals.action ?? "").trim() ? (
        <p className="border-line text-body-sm text-foreground rounded-md border border-dashed px-3 py-2">
          <span className="eyebrow text-faint mr-2">Reads as</span>
          {String(vals.actor || "Who").trim()} shall be able to{" "}
          {String(vals.action).trim().replace(/\.$/, "")}
          {String(vals.benefit ?? "").trim()
            ? `, so that ${String(vals.benefit)
                .trim()
                .replace(/^so that\s+/i, "")}`
            : ""}
          .
        </p>
      ) : null}
      {hints.length ? (
        <ul className="text-caption text-agent-fg flex flex-col gap-0.5">
          {hints.map((h) => (
            <li key={h} className="flex gap-1.5">
              <Sparkles className="mt-0.5 size-3 shrink-0" aria-hidden />
              {h}
            </li>
          ))}
        </ul>
      ) : null}
      {tried && missing.length ? (
        <p className="text-caption text-risk-fg" role="alert">
          Fill in: {missing.map(label).join(", ")}
        </p>
      ) : null}
      <ErrorNote error={capture.error} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-nano text-faint">{spec.hint}</span>
        <Button size="sm" type="submit" disabled={capture.isPending}>
          <Plus className="size-3.5" aria-hidden />{" "}
          {capture.isPending ? "Adding…" : `Add ${spec.label.toLowerCase()}`}
        </Button>
      </div>
    </form>
  );
}
