import type { BacklogItem, BacklogKind, BrdContent } from "@throughline/contracts";
import { storyChecks } from "@throughline/contracts";

export type Index = {
  byId: Map<string, BacklogItem>;
  children: Map<string | null, BacklogItem[]>;
  /** Stories that depend on each story. */
  blocks: Map<string, string[]>;
};

export function buildIndex(items: BacklogItem[]): Index {
  const byId = new Map(items.map((i) => [i.id, i]));
  const children = new Map<string | null, BacklogItem[]>();
  const blocks = new Map<string, string[]>();
  for (const i of items) {
    children.set(i.parentId, [...(children.get(i.parentId) ?? []), i]);
    for (const d of i.dependsOn) blocks.set(d, [...(blocks.get(d) ?? []), i.id]);
  }
  return { byId, children, blocks };
}

/** Ancestors from the top (epic) down to the item's parent. */
export function ancestors(ix: Index, item: BacklogItem): BacklogItem[] {
  const out: BacklogItem[] = [];
  let p = item.parentId ? ix.byId.get(item.parentId) : undefined;
  while (p) {
    out.unshift(p);
    p = p.parentId ? ix.byId.get(p.parentId) : undefined;
  }
  return out;
}

/** Story points and sub-task hours under an item (its own for stories and sub-tasks). */
export function rollup(ix: Index, item: BacklogItem): { points: number; hours: number; stories: number } {
  if (item.type === "subtask") return { points: 0, hours: item.hours ?? 0, stories: 0 };
  const kids = ix.children.get(item.id) ?? [];
  if (item.type === "story")
    return {
      points: item.points ?? 0,
      hours: kids.reduce((a, k) => a + (k.hours ?? 0), 0),
      stories: 1,
    };
  return kids.reduce(
    (a, k) => {
      const r = rollup(ix, k);
      return { points: a.points + r.points, hours: a.hours + r.hours, stories: a.stories + r.stories };
    },
    { points: 0, hours: 0, stories: 0 },
  );
}

/** What a BRD id refers to, in a few words, for trace chips and the traceability view. */
export function traceText(c: BrdContent, id: string): string {
  if (id.startsWith("BR-")) return c.requirements.find((r) => r.id === id)?.title ?? id;
  if (id.startsWith("OBJ-")) return c.objectives.find((o) => o.id === id)?.statement ?? id;
  if (id.startsWith("RULE-")) return c.rules.find((r) => r.id === id)?.statement ?? id;
  if (id.startsWith("NFR-")) return c.nfrs.find((n) => n.id === id)?.statement ?? id;
  if (id.startsWith("R-")) return c.risks.find((r) => r.id === id)?.description ?? id;
  if (id.startsWith("OQ-")) return c.openQuestions.find((q) => q.id === id)?.question ?? id;
  return id;
}

export type Sprint = { name: string; release: string; points: number; stories: BacklogItem[] };

/** Stories grouped into their suggested sprints, in order. */
export function sprintPlan(items: BacklogItem[]): Sprint[] {
  const map = new Map<string, Sprint>();
  for (const s of items.filter((i) => i.type === "story")) {
    const name = s.iteration ?? "Unplanned";
    const sp = map.get(name) ?? { name, release: s.release ?? "", points: 0, stories: [] };
    sp.points += s.points ?? 0;
    sp.stories.push(s);
    map.set(name, sp);
  }
  const n = (s: string) => Number(s.replace(/\D/g, "")) || Number.MAX_SAFE_INTEGER;
  return [...map.values()].sort((a, b) => n(a.name) - n(b.name));
}

export type TreeFilter = { q: string; release: string; kind: BacklogKind | "all"; notReady: boolean };

/** Ids to show: items that match plus their ancestors, so the hierarchy stays readable. */
export function visibleIds(ix: Index, items: BacklogItem[], f: TreeFilter): Set<string> | null {
  const q = f.q.trim().toLowerCase();
  if (!q && f.release === "all" && f.kind === "all" && !f.notReady) return null;
  const hit = (i: BacklogItem) =>
    (!q ||
      i.title.toLowerCase().includes(q) ||
      i.id.toLowerCase() === q ||
      i.traces.some((t) => t.toLowerCase() === q) ||
      i.labels.some((l) => l.includes(q))) &&
    (f.release === "all" || i.release === f.release) &&
    (f.kind === "all" || i.kind === f.kind) &&
    (!f.notReady || (i.type === "story" && storyChecks(i).length > 0));
  const out = new Set<string>();
  for (const i of items) {
    if (i.type === "subtask" || !hit(i)) continue;
    out.add(i.id);
    for (const a of ancestors(ix, i)) out.add(a.id);
  }
  return out;
}
