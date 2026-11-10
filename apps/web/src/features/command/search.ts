/** One thing the command bar can open. `path` is workspace-relative ("/projects/UPI"). */
export type CommandItem = {
  id: string;
  group: "Pages" | "Programs" | "Projects" | "BRDs" | "Work items";
  label: string;
  hint?: string;
  path: string;
  search?: Record<string, string>;
  /** Extra words that should match (keys, owners). */
  keywords?: string;
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD");

/** Rank by how well every word of the query matches: label prefix > label word > anywhere. */
export function searchCommands(items: CommandItem[], query: string, limit = 12): CommandItem[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return items.filter((i) => i.group === "Pages").slice(0, limit);
  const scored: { item: CommandItem; score: number }[] = [];
  for (const item of items) {
    const label = norm(item.label);
    const hay = `${label} ${norm(item.hint ?? "")} ${norm(item.keywords ?? "")}`;
    let score = 0;
    let ok = true;
    for (const w of words) {
      if (label.startsWith(w)) score += 3;
      else if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(label)) score += 2;
      else if (hay.includes(w)) score += 1;
      else {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ item, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
    .slice(0, limit)
    .map((s) => s.item);
}
