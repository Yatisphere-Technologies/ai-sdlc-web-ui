import { BrdContent, type Proposal } from "@throughline/contracts";

type Row = Record<string, unknown>;

/** Field that identifies a row in each list section. */
export const ROW_KEY: Record<string, string> = {
  objectives: "id",
  requirements: "id",
  rules: "id",
  nfrs: "id",
  risks: "id",
  openQuestions: "id",
  stakeholders: "name",
  glossary: "term",
  data: "entity",
  currentState: "step",
  futureState: "step",
};

/** Next free id like BR-11, given the rows already there plus ones already proposed. */
export function nextId(prefix: string, taken: string[], pad = 2): string {
  const nums = taken.filter((t) => t.startsWith(prefix)).map((t) => Number(t.slice(prefix.length)) || 0);
  const n = Math.max(0, ...nums) + 1;
  return `${prefix}${String(n).padStart(pad, "0")}`;
}

/** Applies one accepted proposal to the content and re-validates it. Throws if the result is invalid. */
export function applyProposal(content: BrdContent, p: Proposal): BrdContent {
  const next = structuredClone(content) as unknown as Record<string, unknown>;
  const key = ROW_KEY[p.target] ?? "id";
  const list = () => (Array.isArray(next[p.target]) ? (next[p.target] as Row[]) : []);
  switch (p.op) {
    case "set-text":
      next[p.target] = String(p.value ?? "");
      break;
    case "add-items": {
      const existing = new Set((next[p.target] as string[]).map((x) => x.toLowerCase()));
      next[p.target] = [
        ...(next[p.target] as string[]),
        ...(p.value as string[]).filter((x) => !existing.has(x.toLowerCase())),
      ];
      break;
    }
    case "add-row": {
      const row = { ...(p.value as Row) };
      if (key === "id" && list().some((r) => r.id === row.id)) {
        const prefix = String(row.id).replace(/\d+$/, "");
        row.id = nextId(
          prefix,
          list().map((r) => String(r.id)),
        );
      }
      next[p.target] = [...list(), row];
      break;
    }
    case "update-row":
      next[p.target] = list().map((r) => (r[key] === p.rowId ? { ...r, ...(p.value as Row) } : r));
      break;
    case "remove-row":
      next[p.target] = list().filter((r) => r[key] !== p.rowId);
      break;
  }
  return BrdContent.parse(next);
}
