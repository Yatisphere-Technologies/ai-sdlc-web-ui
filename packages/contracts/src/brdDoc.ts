import { z } from "zod";
import { BRD_SECTION_IDS, type BrdContent, type BrdLayout, type CustomSection } from "./brd";

/* ── The BRD as a free-flowing document ────────────────────────────────────────────────────────
 * The editor stores a rich-text document (ProseMirror/Tiptap JSON). Headings carry an `anchor`
 * that says which BRD section they start; requirements, objectives, risks and the other structured
 * items are "smart blocks" whose attrs hold the item itself. Everything the platform relies on
 * (quality checks, sign-off, the backlog) reads BrdContent, which is derived from the document.
 * When the agent changes BrdContent (an accepted proposal), syncBody writes that change back into
 * the document without disturbing anything else the author wrote.
 */

export type DocMark = { type: string; attrs?: Record<string, unknown> };
export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: DocMark[];
};

export const DocNodeSchema: z.ZodType<DocNode> = z.lazy(() =>
  z.object({
    type: z.string().max(40),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(DocNodeSchema).max(5000).optional(),
    text: z.string().max(100_000).optional(),
    marks: z
      .array(z.object({ type: z.string().max(40), attrs: z.record(z.string(), z.unknown()).optional() }))
      .max(20)
      .optional(),
  }),
);

type TextKey = "summary" | "problem" | "background";
type ListKey =
  | "inScope"
  | "outOfScope"
  | "painPoints"
  | "assumptions"
  | "constraints"
  | "dependencies"
  | "successCriteria";
export type RowKind =
  | "objectives"
  | "stakeholders"
  | "currentState"
  | "futureState"
  | "requirements"
  | "rules"
  | "nfrs"
  | "data"
  | "risks"
  | "glossary"
  | "openQuestions";

export type SectionSpec =
  | { id: string; title: string; text: TextKey }
  | { id: string; title: string; lists: { key: ListKey; label: string }[] }
  | { id: string; title: string; rows: RowKind };

/** What each built-in section holds. The web app's editor definitions must match (a test checks). */
export const BRD_SECTION_SPEC: SectionSpec[] = [
  { id: "summary", title: "Executive summary", text: "summary" },
  { id: "problem", title: "Problem statement", text: "problem" },
  { id: "background", title: "Background", text: "background" },
  { id: "objectives", title: "Business objectives and KPIs", rows: "objectives" },
  {
    id: "scope",
    title: "Scope",
    lists: [
      { key: "inScope", label: "In scope" },
      { key: "outOfScope", label: "Out of scope" },
    ],
  },
  { id: "stakeholders", title: "Stakeholders (RACI)", rows: "stakeholders" },
  { id: "current", title: "Current state (as-is)", rows: "currentState" },
  { id: "pain", title: "Pain points", lists: [{ key: "painPoints", label: "Pain points" }] },
  { id: "future", title: "Future state (to-be)", rows: "futureState" },
  { id: "requirements", title: "Business requirements", rows: "requirements" },
  { id: "rules", title: "Business rules", rows: "rules" },
  { id: "nfrs", title: "Non-functional requirements", rows: "nfrs" },
  { id: "data", title: "Data requirements", rows: "data" },
  {
    id: "context",
    title: "Assumptions, constraints and dependencies",
    lists: [
      { key: "assumptions", label: "Assumptions" },
      { key: "constraints", label: "Constraints" },
      { key: "dependencies", label: "Dependencies" },
    ],
  },
  { id: "risks", title: "Risks", rows: "risks" },
  {
    id: "success",
    title: "Success criteria",
    lists: [{ key: "successCriteria", label: "Success criteria" }],
  },
  { id: "glossary", title: "Glossary", rows: "glossary" },
  { id: "questions", title: "Open questions", rows: "openQuestions" },
];

const SPEC = new Map(BRD_SECTION_SPEC.map((s) => [s.id, s]));
export const ROW_KINDS = BRD_SECTION_SPEC.flatMap((s) => ("rows" in s ? [s.rows] : []));
const TEXT_KEYS = BRD_SECTION_SPEC.flatMap((s) => ("text" in s ? [s.text] : []));
const LIST_KEYS = BRD_SECTION_SPEC.flatMap((s) => ("lists" in s ? s.lists.map((l) => l.key) : []));

/** Field that identifies an item of each kind (process steps have none, so actor + step is used). */
const IDENTITY: Partial<Record<RowKind, string>> = { stakeholders: "name", glossary: "term", data: "entity" };

export function rowKey(kind: string, row: Record<string, unknown>): string {
  if (kind === "currentState" || kind === "futureState") return `${row.actor ?? ""}|${row.step ?? ""}`;
  return String(row[IDENTITY[kind as RowKind] ?? "id"] ?? "");
}
export const rowRef = (kind: string, row: Record<string, unknown>) => `${kind}:${rowKey(kind, row)}`;

/** Section a content key belongs to, and the heading anchor it sits under ("inScope" has its own). */
export function anchorForKey(key: string): { section: string; heading: string } | null {
  for (const s of BRD_SECTION_SPEC) {
    if ("text" in s && s.text === key) return { section: s.id, heading: s.id };
    if ("rows" in s && s.rows === key) return { section: s.id, heading: s.id };
    if ("lists" in s && s.lists.some((l) => l.key === key))
      return { section: s.id, heading: s.lists.length > 1 ? key : s.id };
  }
  return null;
}

/* ── Building blocks ───────────────────────────────────────────────────────────────────────── */

const text = (t: string): DocNode[] => (t ? [{ type: "text", text: t }] : []);
const para = (t = ""): DocNode => ({ type: "paragraph", content: text(t) });
const heading = (level: 2 | 3, anchor: string, t: string): DocNode => ({
  type: "heading",
  attrs: { level, anchor },
  content: text(t),
});
const bullets = (items: string[]): DocNode => ({
  type: "bulletList",
  content: items.map((i) => ({ type: "listItem", content: [para(i)] })),
});
export const smartBlock = (kind: string, row: Record<string, unknown>): DocNode => ({
  type: "smartBlock",
  attrs: { kind, ref: rowRef(kind, row), data: row },
});
const paragraphs = (t: string): DocNode[] => {
  const parts = t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length ? parts.map(para) : [para()];
};

/** Plain text of a node; hard breaks become new lines. */
export function textOf(n: DocNode): string {
  if (n.type === "text") return n.text ?? "";
  if (n.type === "hardBreak") return "\n";
  const inner = (n.content ?? []).map(textOf);
  return n.type === "doc" || n.type === "listItem" || n.type === "blockquote"
    ? inner.join(n.type === "doc" ? "\n\n" : "\n")
    : inner.join("");
}

const listItems = (n: DocNode) => (n.content ?? []).map((li) => textOf(li).trim()).filter(Boolean);

/** The document for a BRD that doesn't have one yet (seeded or created before the editor existed). */
export function buildBody(content: BrdContent, layout: BrdLayout, customSections: CustomSection[]): DocNode {
  const order = [...layout.order];
  for (const id of BRD_SECTION_IDS) if (!order.includes(id)) order.push(id);
  for (const c of customSections) if (!order.includes(c.id)) order.push(c.id);
  const out: DocNode[] = [];
  for (const id of order) {
    if (layout.hidden.includes(id)) continue;
    const s = SPEC.get(id);
    const custom = customSections.find((c) => c.id === id);
    if (!s && !custom) continue;
    out.push(heading(2, id, layout.titles[id] || s?.title || custom?.title || "Untitled section"));
    if (custom) out.push(...paragraphs(custom.body));
    else if (s && "text" in s) out.push(...paragraphs(content[s.text]));
    else if (s && "lists" in s) {
      for (const l of s.lists) {
        if (s.lists.length > 1) out.push(heading(3, l.key, l.label));
        out.push(content[l.key].length ? bullets(content[l.key]) : para());
      }
    } else if (s && "rows" in s) {
      const rows = content[s.rows] as unknown as Record<string, unknown>[];
      out.push(...(rows.length ? rows.map((r) => smartBlock(s.rows, r)) : [para()]));
    }
  }
  return { type: "doc", content: out };
}

/* ── Reading the document back ─────────────────────────────────────────────────────────────── */

const emptyContent = (): BrdContent => ({
  summary: "",
  problem: "",
  background: "",
  objectives: [],
  inScope: [],
  outOfScope: [],
  stakeholders: [],
  currentState: [],
  painPoints: [],
  futureState: [],
  requirements: [],
  rules: [],
  nfrs: [],
  data: [],
  assumptions: [],
  constraints: [],
  dependencies: [],
  risks: [],
  successCriteria: [],
  glossary: [],
  openQuestions: [],
});

function collectSmartBlocks(n: DocNode, into: DocNode[]) {
  if (n.type === "smartBlock") into.push(n);
  for (const c of n.content ?? []) collectSmartBlocks(c, into);
}

/**
 * BrdContent, layout and custom sections as written in the document. Text under a section heading
 * fills that section's text; bullet lists under a list heading fill that list; every smart block
 * becomes an item of its kind, in document order. Text outside a known place (e.g. notes between
 * requirements) stays in the document only.
 */
export function deriveFromBody(
  body: DocNode,
  /** Content of sections that aren't in the document (hidden) is kept from here. */
  previous?: BrdContent,
): {
  content: BrdContent;
  layout: BrdLayout;
  customSections: CustomSection[];
} {
  const content = emptyContent();
  const record = content as unknown as Record<string, unknown>;
  const order: string[] = [];
  const titles: Record<string, string> = {};
  const customs: CustomSection[] = [];
  let section: SectionSpec | null = null;
  let custom: CustomSection | null = null;
  let listKey: ListKey | null = null;
  const textParts = new Map<string, string[]>();
  const addText = (key: string, t: string) => {
    if (!t.trim()) return;
    textParts.set(key, [...(textParts.get(key) ?? []), t.trim()]);
  };

  for (const n of body.content ?? []) {
    if (n.type === "heading" && n.attrs?.level === 2) {
      const anchor = typeof n.attrs.anchor === "string" ? n.attrs.anchor : "";
      const title = textOf(n).trim();
      const spec = SPEC.get(anchor);
      listKey = null;
      if (spec && !order.includes(anchor)) {
        section = spec;
        custom = null;
        order.push(anchor);
        if (title && title !== spec.title) titles[anchor] = title;
        if ("lists" in spec && spec.lists.length === 1) listKey = spec.lists[0]?.key ?? null;
      } else {
        section = null;
        const id =
          anchor && !order.includes(anchor) && !SPEC.has(anchor) ? anchor : `custom-${customs.length + 1}`;
        custom = { id, title: title || "Untitled section", body: "" };
        customs.push(custom);
        order.push(id);
      }
      continue;
    }
    if (n.type === "heading" && section && "lists" in section) {
      const anchor = String(n.attrs?.anchor ?? "");
      const match = section.lists.find((l) => l.key === anchor || l.label === textOf(n).trim());
      if (match) {
        listKey = match.key;
        continue;
      }
    }
    if (n.type === "bulletList" || n.type === "orderedList") {
      const items = listItems(n);
      if (section && "lists" in section && listKey)
        record[listKey] = [...(record[listKey] as string[]), ...items];
      else if (section && "text" in section) addText(section.text, items.map((i) => `- ${i}`).join("\n"));
      else if (custom) addText(custom.id, items.map((i) => `- ${i}`).join("\n"));
      continue;
    }
    if (n.type === "smartBlock") continue;
    const t = textOf(n);
    if (section && "text" in section) addText(section.text, t);
    else if (custom) addText(custom.id, t);
  }

  for (const key of TEXT_KEYS) record[key] = (textParts.get(key) ?? []).join("\n\n");
  for (const c of customs) c.body = (textParts.get(c.id) ?? []).join("\n\n");

  const blocks: DocNode[] = [];
  collectSmartBlocks(body, blocks);
  const seen = new Set<string>();
  for (const b of blocks) {
    const kind = String(b.attrs?.kind ?? "");
    const data = b.attrs?.data;
    if (!ROW_KINDS.includes(kind as RowKind) || !data || typeof data !== "object") continue;
    const ref = rowRef(kind, data as Record<string, unknown>);
    if (seen.has(ref)) continue;
    seen.add(ref);
    (record[kind] as unknown[]).push(data);
  }

  const hidden = BRD_SECTION_IDS.filter((id) => !order.includes(id));
  if (previous) {
    for (const id of hidden) {
      const spec = SPEC.get(id);
      if (!spec) continue;
      if ("text" in spec) record[spec.text] = previous[spec.text];
      else if ("lists" in spec) for (const l of spec.lists) record[l.key] = previous[l.key];
      else if ((record[spec.rows] as unknown[]).length === 0) record[spec.rows] = previous[spec.rows];
    }
  }
  return {
    content,
    layout: { order: [...order, ...hidden], titles, hidden: [...hidden] },
    customSections: customs,
  };
}

/* ── Writing agent changes back into the document ──────────────────────────────────────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Index range [start, end) of a heading's body: up to the next heading of the same or higher level. */
function headingRange(nodes: DocNode[], anchor: string): [number, number] | null {
  const at = nodes.findIndex((n) => n.type === "heading" && n.attrs?.anchor === anchor);
  if (at < 0) return null;
  const level = Number(nodes[at]?.attrs?.level ?? 2);
  let end = at + 1;
  while (end < nodes.length) {
    const n = nodes[end] as DocNode;
    if (n.type === "heading" && Number(n.attrs?.level ?? 2) <= level) break;
    end++;
  }
  return [at, end];
}

/** Body of a list heading: up to the next heading of any level. */
function untilNextHeading(nodes: DocNode[], from: number) {
  let end = from;
  while (end < nodes.length && nodes[end]?.type !== "heading") end++;
  return end;
}

const isEmptyPara = (n: DocNode | undefined) => n?.type === "paragraph" && !textOf(n).trim();

/**
 * Applies BrdContent to an existing document: changed text and lists are rewritten in place,
 * items are updated, removed or added next to their siblings, and a section that isn't in the
 * document yet is appended. Everything that didn't change is left exactly as the author wrote it.
 */
export function syncBody(body: DocNode, content: BrdContent): DocNode {
  const nodes = [...(body.content ?? [])].map((n) => ({ ...n }));
  const derived = deriveFromBody({ type: "doc", content: nodes }).content;
  const ensureSection = (id: string) => {
    if (nodes.some((n) => n.type === "heading" && n.attrs?.anchor === id)) return;
    const spec = SPEC.get(id);
    if (!spec) return;
    nodes.push(heading(2, id, spec.title));
    if ("lists" in spec && spec.lists.length > 1)
      for (const l of spec.lists) nodes.push(heading(3, l.key, l.label), para());
    else nodes.push(para());
  };

  for (const key of TEXT_KEYS) {
    if (derived[key] === content[key]) continue;
    ensureSection(key);
    const r = headingRange(nodes, key);
    if (!r) continue;
    const end = untilNextHeading(nodes, r[0] + 1);
    // Keep smart blocks someone placed in a text section.
    const kept = nodes.slice(r[0] + 1, end).filter((n) => n.type === "smartBlock");
    nodes.splice(r[0] + 1, end - r[0] - 1, ...paragraphs(content[key]), ...kept);
  }

  for (const key of LIST_KEYS) {
    if (same(derived[key], content[key])) continue;
    const at = anchorForKey(key);
    if (!at) continue;
    ensureSection(at.section);
    let h = nodes.findIndex((n) => n.type === "heading" && n.attrs?.anchor === at.heading);
    if (h < 0) {
      // A multi-list section without this sub-heading: add it at the end of the section.
      const r = headingRange(nodes, at.section);
      if (!r) continue;
      const label =
        BRD_SECTION_SPEC.flatMap((s) => ("lists" in s ? s.lists : [])).find((l) => l.key === key)?.label ??
        key;
      nodes.splice(r[1], 0, heading(3, key, label), para());
      h = r[1];
    }
    const end = untilNextHeading(nodes, h + 1);
    const others = nodes
      .slice(h + 1, end)
      .filter((n) => n.type !== "bulletList" && n.type !== "orderedList" && !isEmptyPara(n));
    nodes.splice(
      h + 1,
      end - h - 1,
      ...(content[key].length ? [bullets(content[key])] : [para()]),
      ...others,
    );
  }

  for (const kind of ROW_KINDS) {
    const rows = content[kind] as unknown as Record<string, unknown>[];
    const byKey = new Map(rows.map((r) => [rowKey(kind, r), r]));
    const placed = new Set<string>();
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i] as DocNode;
      if (n.type !== "smartBlock" || n.attrs?.kind !== kind) continue;
      const key = rowKey(kind, (n.attrs?.data ?? {}) as Record<string, unknown>);
      const row = byKey.get(key);
      if (!row || placed.has(key)) nodes.splice(i, 1);
      else {
        placed.add(key);
        if (!same(row, n.attrs?.data)) nodes[i] = smartBlock(kind, row);
      }
    }
    const missing = rows.filter((r) => !placed.has(rowKey(kind, r)));
    if (!missing.length) continue;
    const at = anchorForKey(kind);
    if (!at) continue;
    ensureSection(at.section);
    let last = -1;
    nodes.forEach((n, i) => {
      if (n.type === "smartBlock" && n.attrs?.kind === kind) last = i;
    });
    let insertAt: number;
    if (last >= 0) insertAt = last + 1;
    else {
      const h = nodes.findIndex((n) => n.type === "heading" && n.attrs?.anchor === at.section);
      insertAt = h + 1;
      if (isEmptyPara(nodes[insertAt])) nodes.splice(insertAt, 1);
    }
    nodes.splice(insertAt, 0, ...missing.map((r) => smartBlock(kind, r)));
  }
  return { ...body, type: "doc", content: nodes };
}

/* ── Section operations (outline) ──────────────────────────────────────────────────────────── */

/** Top-level sections: each h2 with the nodes up to the next h2. */
function sections(nodes: DocNode[]) {
  const out: { id: string; start: number; end: number }[] = [];
  nodes.forEach((n, i) => {
    if (n.type === "heading" && n.attrs?.level === 2) {
      const last = out.at(-1);
      if (last) last.end = i;
      out.push({ id: String(n.attrs?.anchor ?? ""), start: i, end: nodes.length });
    }
  });
  return out;
}

/** Moves a section (heading and everything under it) up or down past its neighbour. */
export function moveSection(body: DocNode, id: string, dir: -1 | 1): DocNode {
  const nodes = [...(body.content ?? [])];
  const secs = sections(nodes);
  const i = secs.findIndex((x) => x.id === id);
  const j = i + dir;
  const a = secs[Math.min(i, j)];
  const b = secs[Math.max(i, j)];
  if (i < 0 || !a || !b || j < 0 || j >= secs.length) return body;
  const first = nodes.slice(a.start, a.end);
  const second = nodes.slice(b.start, b.end);
  nodes.splice(a.start, b.end - a.start, ...second, ...first);
  return { ...body, content: nodes };
}

/** Takes a section out of the document. A built-in section's content is kept and can be restored. */
export function removeSection(body: DocNode, id: string): DocNode {
  const nodes = [...(body.content ?? [])];
  const sec = sections(nodes).find((x) => x.id === id);
  if (!sec) return body;
  nodes.splice(sec.start, sec.end - sec.start);
  return { ...body, content: nodes };
}

/** Puts a built-in section back at the end, rebuilt from the content. */
export function restoreSection(body: DocNode, id: string, content: BrdContent, title?: string): DocNode {
  if ((body.content ?? []).some((n) => n.type === "heading" && n.attrs?.anchor === id)) return body;
  const piece = buildBody(
    content,
    { order: [id], titles: title ? { [id]: title } : {}, hidden: BRD_SECTION_IDS.filter((x) => x !== id) },
    [],
  );
  return { ...body, content: [...(body.content ?? []), ...(piece.content ?? [])] };
}

/** Adds an empty section of the author's own at the end. */
export function addSection(body: DocNode, id: string, title: string): DocNode {
  return { ...body, content: [...(body.content ?? []), heading(2, id, title), para()] };
}
