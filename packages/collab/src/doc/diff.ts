/** Word-level diff for showing a suggested rewrite as a tracked change. */

export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** Splits into words and the whitespace/punctuation between them, so joining the parts gives the input back. */
export function tokenize(s: string): string[] {
  return s.match(/\s+|[\p{L}\p{N}'’-]+|[^\s\p{L}\p{N}]/gu) ?? [];
}

const MAX_CELLS = 400_000;

/**
 * Longest-common-subsequence diff over tokens. Very long inputs fall back to "replace all" so the
 * table stays small; equal runs are merged so the output reads naturally.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) return before ? [{ type: "same", text: before }] : [];
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > MAX_CELLS) {
    return [
      ...(before ? [{ type: "del" as const, text: before }] : []),
      ...(after ? [{ type: "add" as const, text: after }] : []),
    ];
  }
  // dp[i][j] = LCS length of a[i:] and b[j:]
  const w = b.length + 1;
  const dp = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i * w + j] =
        a[i] === b[j]
          ? (dp[(i + 1) * w + j + 1] ?? 0) + 1
          : Math.max(dp[(i + 1) * w + j] ?? 0, dp[i * w + j + 1] ?? 0);
    }
  }
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out.at(-1);
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i] ?? "");
      i++;
      j++;
    } else if ((dp[(i + 1) * w + j] ?? 0) >= (dp[i * w + j + 1] ?? 0)) {
      push("del", a[i++] ?? "");
    } else {
      push("add", b[j++] ?? "");
    }
  }
  while (i < a.length) push("del", a[i++] ?? "");
  while (j < b.length) push("add", b[j++] ?? "");
  return absorbWhitespace(out);
}

/** A lone space between two changes reads better inside the change than as unchanged text. */
function absorbWhitespace(parts: DiffPart[]): DiffPart[] {
  const out: DiffPart[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k] as DiffPart;
    const prev = out.at(-1);
    const next = parts[k + 1];
    if (
      p.type === "same" &&
      /^\s+$/.test(p.text) &&
      prev &&
      prev.type !== "same" &&
      next &&
      next.type !== "same"
    ) {
      const del = out.findLast((x) => x.type === "del");
      if (del) del.text += p.text;
      if (next.type === "add") next.text = p.text + next.text;
      else {
        const add = out.findLast((x) => x.type === "add");
        if (add) add.text += p.text;
      }
      continue;
    }
    if (prev && prev.type === p.type) prev.text += p.text;
    else out.push({ ...p });
  }
  return out;
}

/** Share of the text that changed, 0–1. */
export function changeRatio(parts: DiffPart[]): number {
  const total = parts.reduce((n, p) => n + p.text.length, 0);
  if (!total) return 0;
  return parts.filter((p) => p.type !== "same").reduce((n, p) => n + p.text.length, 0) / total;
}
