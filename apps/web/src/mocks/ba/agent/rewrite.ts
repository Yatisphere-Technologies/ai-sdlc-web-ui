/**
 * Deterministic rewrites the simulated agent can do on a passage the author selected: tighten,
 * make measurable, make formal, fix grammar. A model-backed agent does these properly; these keep
 * the demo honest by only making changes that are mechanically safe.
 */

export type RewriteKind = "concise" | "measurable" | "formal" | "grammar";

const VAGUE: [RegExp, string][] = [
  [/\b(as soon as possible|asap|immediately)\b/gi, "within 15 minutes"],
  [/\b(quickly|fast|rapidly|promptly)\b/gi, "within 2 seconds at p95"],
  [/\b(user-friendly|easy|easily|intuitive|simple)\b/gi, "in no more than 3 steps"],
  [/\b(seamless(ly)?)\b/gi, "without re-entering any data"],
  [/\b(robust|reliable)\b/gi, "with 99.9% success over a month"],
  [/\b(a lot of|lots of|many|numerous)\b/gi, "[number]"],
];

const FILLER: [RegExp, string][] = [
  [/\bin order to\b/gi, "to"],
  [/\bdue to the fact that\b/gi, "because"],
  [/\bat this point in time\b/gi, "now"],
  [/\bfor the purpose of\b/gi, "to"],
  [/\bis able to\b/gi, "can"],
  [/\bare able to\b/gi, "can"],
  [/\bin the event that\b/gi, "if"],
  [/\bwith regard to\b/gi, "about"],
  [/\b(basically|actually|really|very|quite|just|simply|essentially|currently) /gi, ""],
  [/\bthe fact that\b/gi, "that"],
  [/\bit is important to note that\s*/gi, ""],
];

const FORMAL: [RegExp, string][] = [
  [/\bcan't\b/gi, "cannot"],
  [/\bwon't\b/gi, "will not"],
  [/\bdon't\b/gi, "do not"],
  [/\bdoesn't\b/gi, "does not"],
  [/\bisn't\b/gi, "is not"],
  [/\baren't\b/gi, "are not"],
  [/\bit's\b/gi, "it is"],
  [/\bthey're\b/gi, "they are"],
  [/\bwe're\b/gi, "we are"],
  [/\bwe want to\b/gi, "the business aims to"],
  [/\bwe need to\b/gi, "the business needs to"],
  [/\ba lot of\b/gi, "a large number of"],
  [/\bget(s)? back\b/gi, "receive$1"],
  [/\bkeep(s)? getting\b/gi, "continue$1 to be"],
  [/\bstuff\b/gi, "items"],
  [/\bok(ay)?\b/gi, "acceptable"],
];

const apply = (s: string, rules: [RegExp, string][]) =>
  rules.reduce(
    (acc, [re, rep]) => acc.replace(re, (m, ...g) => matchCase(m, rep.replace(/\$1/g, String(g[0] ?? "")))),
    s,
  );

/** Keeps a capital at the start of a sentence after a replacement. */
function matchCase(original: string, replacement: string) {
  if (!replacement) return replacement;
  return /^[A-Z]/.test(original) ? replacement.charAt(0).toUpperCase() + replacement.slice(1) : replacement;
}

function grammar(s: string) {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,.;:!?])(?=[A-Za-z])/g, "$1 ")
    .replace(/(^|[.!?]\s+)([a-z])/g, (_, a, b: string) => a + b.toUpperCase())
    .replace(/\bi\b/g, "I")
    .replace(/([^.!?\s])\s*$/, "$1.")
    .trim();
}

function concise(s: string, maxSentences: number | null) {
  let out = apply(s, FILLER).replace(/\s*\([^)]{0,80}\)/g, "");
  if (maxSentences) {
    const parts = out.split(/(?<=[.!?])\s+/);
    if (parts.length > maxSentences) out = parts.slice(0, maxSentences).join(" ");
  }
  return grammar(out);
}

export function rewriteKind(instruction: string): RewriteKind | "expand" | null {
  const t = instruction.toLowerCase();
  if (/expand|elaborate|more detail|longer|add more/.test(t)) return "expand";
  if (/concise|shorter|shorten|tighten|trim|brief|simplif|cut/.test(t)) return "concise";
  if (/measur|testable|specific|vague|quantif|number/.test(t)) return "measurable";
  if (/formal|professional|polish|tone/.test(t)) return "formal";
  if (/grammar|typo|spelling|punctuat|proofread/.test(t)) return "grammar";
  if (/rewrite|improve|better|clean|clear|reword/.test(t)) return "concise";
  return null;
}

/** Rewrites `text`; with a quote, only that passage changes. Returns the new full text. */
export function rewrite(
  text: string,
  kind: RewriteKind,
  quote: string | null,
  maxSentences: number | null = null,
) {
  const fn = (s: string) =>
    kind === "concise"
      ? concise(s, quote ? null : maxSentences)
      : kind === "measurable"
        ? apply(s, VAGUE)
        : kind === "formal"
          ? grammar(apply(s, FORMAL))
          : grammar(s);
  if (quote) {
    const at = text.indexOf(quote);
    if (at >= 0) {
      let next = fn(quote);
      // A rewritten fragment shouldn't gain a full stop the original didn't have.
      if (!/[.!?]$/.test(quote)) next = next.replace(/[.!?]$/, "");
      return text.slice(0, at) + next + text.slice(at + quote.length);
    }
  }
  return fn(text);
}

export const KIND_LABEL: Record<RewriteKind, string> = {
  concise: "tighter",
  measurable: "measurable",
  formal: "more formal",
  grammar: "proofread",
};
