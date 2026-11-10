const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const idOf = (x: unknown) =>
  x && typeof x === "object" && "id" in x && typeof x.id === "string" ? x.id : null;
const keyed = (xs: unknown) =>
  Array.isArray(xs) && xs.every((x) => idOf(x) !== null) ? (xs as { id: string }[]) : null;

/**
 * Undo one agent edit to a field. Lists of items are undone item by item, so later edits to other
 * items in the same section don't block it. Returns null when what this edit touched has changed since.
 */
export function undoField(current: unknown, before: unknown, after: unknown): { value: unknown } | null {
  const cur = keyed(current);
  const b = keyed(before);
  const a = keyed(after);
  if (!cur || !b || !a) return same(current, after) ? { value: before } : null;
  const byId = (xs: { id: string }[]) => new Map(xs.map((x) => [x.id, x]));
  const B = byId(b);
  const A = byId(a);
  const C = byId(cur);
  // Rows this edit added or changed must still be as it left them; rows it removed must still be gone.
  for (const [id, row] of A) if (!same(B.get(id), row) && !same(C.get(id), row)) return null;
  for (const id of B.keys()) if (!A.has(id) && C.has(id)) return null;
  const out: { id: string }[] = [];
  for (const row of cur) {
    if (!A.has(row.id) || same(B.get(row.id), A.get(row.id))) out.push(row);
    else if (B.has(row.id)) out.push(B.get(row.id) as { id: string });
  }
  // Put back rows this edit removed, at their old position where possible.
  b.forEach((row, i) => {
    if (!A.has(row.id)) out.splice(Math.min(i, out.length), 0, row);
  });
  return { value: out };
}
