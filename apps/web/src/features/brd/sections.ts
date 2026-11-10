import type { Brd, BrdContent, CustomSection } from "@throughline/contracts";

/**
 * The BRD's sections in reading order, and how each one is edited. The document view and the
 * editor are both driven from this list, so adding a field means adding it here once.
 */
export type Field = {
  key: string;
  label: string;
  kind: "text" | "area" | "select" | "lines";
  options?: readonly { value: string; label: string }[];
  /** Grid columns the field spans in the editor (of 6). */
  span?: 1 | 2 | 3 | 6;
};

type ArrayKeys = {
  [K in keyof BrdContent]: BrdContent[K] extends readonly (infer U)[]
    ? U extends object
      ? K
      : never
    : never;
}[keyof BrdContent];
type ListKeys = {
  [K in keyof BrdContent]: BrdContent[K] extends readonly string[] ? K : never;
}[keyof BrdContent];
type TextKeys = { [K in keyof BrdContent]: BrdContent[K] extends string ? K : never }[keyof BrdContent];

export type Section =
  | { id: string; title: string; kind: "text"; key: TextKeys; hint: string }
  | { id: string; title: string; kind: "list"; keys: { key: ListKeys; label: string }[]; hint: string }
  | {
      id: string;
      title: string;
      kind: "rows";
      key: ArrayKeys;
      fields: Field[];
      idPrefix?: string;
      hint: string;
    };

const opt = (...v: string[]) => v.map((x) => ({ value: x, label: x }));

export const MOSCOW_OPTIONS = [
  { value: "must", label: "Must" },
  { value: "should", label: "Should" },
  { value: "could", label: "Could" },
  { value: "wont", label: "Won't" },
] as const;

export const SECTIONS: Section[] = [
  {
    id: "summary",
    title: "Executive summary",
    kind: "text",
    key: "summary",
    hint: "What we're doing and why, in one paragraph a sponsor can approve from.",
  },
  {
    id: "problem",
    title: "Problem statement",
    kind: "text",
    key: "problem",
    hint: "The business problem in measurable terms.",
  },
  {
    id: "background",
    title: "Background",
    kind: "text",
    key: "background",
    hint: "Context the reader needs.",
  },
  {
    id: "objectives",
    title: "Business objectives and KPIs",
    kind: "rows",
    key: "objectives",
    idPrefix: "OBJ-",
    hint: "Each objective needs a KPI, a baseline and a numeric target.",
    fields: [
      { key: "id", label: "Id", kind: "text", span: 1 },
      { key: "statement", label: "Objective", kind: "text", span: 3 },
      { key: "kpi", label: "KPI", kind: "text", span: 2 },
      { key: "baseline", label: "Baseline", kind: "text", span: 3 },
      { key: "target", label: "Target", kind: "text", span: 3 },
    ],
  },
  {
    id: "scope",
    title: "Scope",
    kind: "list",
    keys: [
      { key: "inScope", label: "In scope" },
      { key: "outOfScope", label: "Out of scope" },
    ],
    hint: "Saying what's out is as important as what's in.",
  },
  {
    id: "stakeholders",
    title: "Stakeholders (RACI)",
    kind: "rows",
    key: "stakeholders",
    hint: "Exactly one Accountable person; everyone affected is listed.",
    fields: [
      { key: "name", label: "Name", kind: "text", span: 2 },
      { key: "role", label: "Role", kind: "text", span: 2 },
      { key: "raci", label: "RACI", kind: "select", options: opt("R", "A", "C", "I"), span: 2 },
      { key: "interest", label: "Interest", kind: "text", span: 6 },
    ],
  },
  {
    id: "current",
    title: "Current state (as-is)",
    kind: "rows",
    key: "currentState",
    hint: "How it works today, step by step.",
    fields: [
      { key: "actor", label: "Actor", kind: "text", span: 2 },
      { key: "step", label: "Step", kind: "text", span: 6 },
    ],
  },
  {
    id: "pain",
    title: "Pain points",
    kind: "list",
    keys: [{ key: "painPoints", label: "Pain points" }],
    hint: "What hurts today.",
  },
  {
    id: "future",
    title: "Future state (to-be)",
    kind: "rows",
    key: "futureState",
    hint: "How it will work once delivered.",
    fields: [
      { key: "actor", label: "Actor", kind: "text", span: 2 },
      { key: "step", label: "Step", kind: "text", span: 6 },
    ],
  },
  {
    id: "requirements",
    title: "Business requirements",
    kind: "rows",
    key: "requirements",
    idPrefix: "BR-",
    hint: "Business language, one need each, MoSCoW priority, testable acceptance criteria, linked to an objective.",
    fields: [
      { key: "id", label: "Id", kind: "text", span: 1 },
      { key: "title", label: "Title", kind: "text", span: 3 },
      { key: "priority", label: "Priority", kind: "select", options: MOSCOW_OPTIONS, span: 2 },
      { key: "statement", label: "Requirement", kind: "area", span: 6 },
      { key: "rationale", label: "Rationale", kind: "text", span: 6 },
      { key: "area", label: "Capability area (epic)", kind: "text", span: 2 },
      { key: "actor", label: "Actor", kind: "text", span: 2 },
      { key: "objective", label: "Objective", kind: "text", span: 2 },
      { key: "source", label: "Source", kind: "text", span: 6 },
      { key: "acceptance", label: "Acceptance criteria (one per line)", kind: "lines", span: 6 },
    ],
  },
  {
    id: "rules",
    title: "Business rules",
    kind: "rows",
    key: "rules",
    idPrefix: "RULE-",
    hint: "Policies the solution must enforce, with where they come from.",
    fields: [
      { key: "id", label: "Id", kind: "text", span: 1 },
      { key: "statement", label: "Rule", kind: "text", span: 3 },
      { key: "source", label: "Source", kind: "text", span: 2 },
    ],
  },
  {
    id: "nfrs",
    title: "Non-functional requirements",
    kind: "rows",
    key: "nfrs",
    idPrefix: "NFR-",
    hint: "Business-level quality needs with measurable targets.",
    fields: [
      { key: "id", label: "Id", kind: "text", span: 1 },
      {
        key: "category",
        label: "Category",
        kind: "select",
        options: opt(
          "availability",
          "performance",
          "security",
          "compliance",
          "usability",
          "reporting",
          "data",
        ),
        span: 2,
      },
      { key: "statement", label: "Requirement", kind: "text", span: 3 },
      { key: "target", label: "Target", kind: "text", span: 6 },
    ],
  },
  {
    id: "data",
    title: "Data requirements",
    kind: "rows",
    key: "data",
    hint: "What data the solution holds, how sensitive it is and how long it is kept.",
    fields: [
      { key: "entity", label: "Entity", kind: "text", span: 2 },
      {
        key: "classification",
        label: "Classification",
        kind: "select",
        options: opt("public", "internal", "confidential", "restricted"),
        span: 2,
      },
      { key: "retention", label: "Retention", kind: "text", span: 2 },
      { key: "description", label: "Description", kind: "text", span: 6 },
    ],
  },
  {
    id: "context",
    title: "Assumptions, constraints and dependencies",
    kind: "list",
    keys: [
      { key: "assumptions", label: "Assumptions" },
      { key: "constraints", label: "Constraints" },
      { key: "dependencies", label: "Dependencies" },
    ],
    hint: "What we take as true, what limits us, and who we wait on.",
  },
  {
    id: "risks",
    title: "Risks",
    kind: "rows",
    key: "risks",
    idPrefix: "R-",
    hint: "Every risk has an owner and a mitigation.",
    fields: [
      { key: "id", label: "Id", kind: "text", span: 1 },
      { key: "description", label: "Risk", kind: "text", span: 3 },
      { key: "impact", label: "Impact", kind: "select", options: opt("high", "medium", "low"), span: 1 },
      {
        key: "likelihood",
        label: "Likelihood",
        kind: "select",
        options: opt("high", "medium", "low"),
        span: 1,
      },
      { key: "mitigation", label: "Mitigation", kind: "text", span: 3 },
      { key: "owner", label: "Owner", kind: "text", span: 3 },
    ],
  },
  {
    id: "success",
    title: "Success criteria",
    kind: "list",
    keys: [{ key: "successCriteria", label: "Success criteria" }],
    hint: "How we'll know it worked.",
  },
  {
    id: "glossary",
    title: "Glossary",
    kind: "rows",
    key: "glossary",
    hint: "Terms a new reader needs.",
    fields: [
      { key: "term", label: "Term", kind: "text", span: 2 },
      { key: "definition", label: "Definition", kind: "text", span: 6 },
    ],
  },
  {
    id: "questions",
    title: "Open questions",
    kind: "rows",
    key: "openQuestions",
    idPrefix: "OQ-",
    hint: "Unanswered questions are shown to approvers.",
    fields: [
      { key: "id", label: "Id", kind: "text", span: 1 },
      { key: "question", label: "Question", kind: "text", span: 3 },
      { key: "status", label: "Status", kind: "select", options: opt("open", "resolved"), span: 2 },
      { key: "owner", label: "Owner", kind: "text", span: 2 },
      { key: "answer", label: "Answer", kind: "text", span: 6 },
    ],
  },
];

/** Section id used by the quality checks, mapped to where it lives in the document. */
export const CHECK_SECTION: Record<string, string> = {
  summary: "summary",
  problem: "problem",
  objectives: "objectives",
  scope: "scope",
  stakeholders: "stakeholders",
  requirements: "requirements",
  nfrs: "nfrs",
  risks: "risks",
  questions: "questions",
};

/** A blank row for a section, with the next free id when the section uses ids. */
export function blankRow(
  section: Extract<Section, { kind: "rows" }>,
  rows: readonly object[],
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const f of section.fields)
    row[f.key] = f.kind === "lines" ? [] : f.kind === "select" ? (f.options?.[0]?.value ?? "") : "";
  if (section.idPrefix) {
    const nums = rows.map((r) => Number(String((r as { id?: string }).id ?? "").replace(/\D/g, "")) || 0);
    const n = Math.max(0, ...nums) + 1;
    row.id = `${section.idPrefix}${section.idPrefix === "BR-" || section.idPrefix === "NFR-" || section.idPrefix === "RULE-" ? String(n).padStart(2, "0") : n}`;
  }
  if (section.key === "requirements") row.priority = "should";
  if (section.key === "openQuestions") row.status = "open";
  return row;
}

export type PlacedSection =
  | { kind: "builtin"; id: string; number: number; title: string; section: Section }
  | { kind: "custom"; id: string; number: number; title: string; custom: CustomSection };

/** Sections in the author's order, with their (possibly renamed) titles and numbers. Hidden ones are left out. */
export function placedSections(
  doc: Pick<Brd, "layout" | "customSections">,
  opts: { includeHidden?: boolean } = {},
): (PlacedSection & { hidden: boolean })[] {
  const builtins = new Map(SECTIONS.map((s) => [s.id, s]));
  const customs = new Map(doc.customSections.map((c) => [c.id, c]));
  const order = [...doc.layout.order];
  for (const s of SECTIONS) if (!order.includes(s.id)) order.push(s.id);
  for (const c of doc.customSections) if (!order.includes(c.id)) order.push(c.id);
  const out: (PlacedSection & { hidden: boolean })[] = [];
  let n = 0;
  for (const id of order) {
    const hidden = doc.layout.hidden.includes(id);
    if (hidden && !opts.includeHidden) continue;
    const b = builtins.get(id);
    const c = customs.get(id);
    if (!b && !c) continue;
    const number = hidden ? 0 : ++n;
    if (b)
      out.push({ kind: "builtin", id, number, title: doc.layout.titles[id] || b.title, section: b, hidden });
    else if (c) out.push({ kind: "custom", id, number, title: c.title, custom: c, hidden });
  }
  return out;
}

/** Section that holds a content key, e.g. "outOfScope" → "scope", "currentState" → "current". */
export function sectionOfTarget(target: string): string {
  for (const s of SECTIONS) {
    if (s.kind === "text" && s.key === target) return s.id;
    if (s.kind === "rows" && s.key === target) return s.id;
    if (s.kind === "list" && s.keys.some((k) => k.key === target)) return s.id;
  }
  return target;
}
