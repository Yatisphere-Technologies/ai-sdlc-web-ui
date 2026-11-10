import type { Participant } from "@throughline/collab";
import type { Brd, BrdContent, BrdSource, BrdThread, CommentThread, Proposal } from "@throughline/contracts";
import { sectionOfTarget } from "../brd/sections";

/**
 * Adapters between BRD Studio's data and the reusable collaboration components: who is in the
 * document, which proposals show where, and how comment threads map to blocks.
 */

export const AGENT_ID = "agent";
export const personId = (name: string) => `p:${name}`;

/** You, the BA agent, and everyone who has worked on this BRD (approvers, commenters, authors). */
export function participants(brd: Brd, comments: CommentThread[], me: string): Participant[] {
  const roles = new Map<string, string>();
  for (const a of brd.approvals)
    if (a.name && a.name !== "To be assigned") roles.set(a.name, `${a.capacity} approver`);
  if (!roles.has(brd.owner)) roles.set(brd.owner, "Owner");
  for (const h of brd.history) if (h.by !== "BA agent" && !roles.has(h.by)) roles.set(h.by, "Editor");
  for (const c of comments)
    for (const m of c.messages)
      if (m.role === "human" && !roles.has(m.author)) roles.set(m.author, "Commenter");
  const people: Participant[] = [
    { id: personId(me), name: me, kind: "human", you: true, online: true, role: roles.get(me) },
    { id: AGENT_ID, name: "BA agent", kind: "agent", online: true, role: "Simulated agent" },
  ];
  for (const [name, role] of roles)
    if (name !== me) people.push({ id: personId(name), name, kind: "human", role });
  return people;
}

/** Every proposal in the chat and in comment threads. */
export function allProposals(thread: BrdThread, comments: CommentThread[]): Proposal[] {
  return [
    ...thread.messages.flatMap((m) => m.proposals),
    ...comments.flatMap((c) => c.messages.flatMap((m) => m.proposals)),
  ];
}

type Row = Record<string, unknown>;
const ROW_KEY: Record<string, string> = { stakeholders: "name", glossary: "term", data: "entity" };

/** The current row a proposal changes, if any. */
function currentRow(content: BrdContent, p: Proposal): Row | undefined {
  const rows = (content as unknown as Record<string, unknown>)[p.target];
  if (!Array.isArray(rows) || !p.rowId) return undefined;
  const key = ROW_KEY[p.target] ?? "id";
  return (rows as Row[]).find((r) => r[key] === p.rowId);
}

/** Before/after text when a proposal rewrites one text field, so it can show as a tracked change. */
export function textChange(content: BrdContent, p: Proposal): { before: string; after: string } | null {
  if (p.op === "set-text") {
    const before = (content as unknown as Record<string, unknown>)[p.target];
    return typeof before === "string" ? { before, after: String(p.value ?? "") } : null;
  }
  if (p.op === "update-row") {
    const row = currentRow(content, p);
    const v = (p.value ?? {}) as Row;
    const keys = Object.keys(v);
    for (const field of ["statement", "description", "mitigation", "target"]) {
      if (keys.length === 1 && keys[0] === field && row && typeof row[field] === "string")
        return { before: row[field] as string, after: String(v[field]) };
    }
    if (keys.includes("statement") && row && typeof row.statement === "string")
      return { before: row.statement as string, after: String(v.statement) };
  }
  if (p.op === "remove-row") {
    const row = currentRow(content, p);
    const text = row ? String(row.statement ?? row.description ?? row.question ?? row.name ?? "") : "";
    return text ? { before: text, after: "" } : null;
  }
  return null;
}

/** Where a proposal shows in the document. */
export function anchorOf(p: Proposal) {
  return { blockId: sectionOfTarget(p.target), rowId: p.rowId };
}

/** Source chip label: "notes.pdf · 12 passages". */
export function sourceDetail(s: BrdSource) {
  return s.status === "ready"
    ? `${s.id} · ${s.passages.length} passage${s.passages.length === 1 ? "" : "s"}`
    : s.status === "linked"
      ? `${s.id} · saved, not read`
      : "Couldn't read";
}
