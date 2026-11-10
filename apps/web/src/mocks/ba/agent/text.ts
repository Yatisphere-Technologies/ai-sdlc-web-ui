/** Small, dependency-free text helpers the simulated BA agent uses to read sources and messages. */

export const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Splits text into sentences, keeping numbers like "1.5" and abbreviations like "e.g." intact. */
export function sentences(text: string): string[] {
  const t = text.replace(/\r/g, "").replace(/([a-z])\n(?=[a-z])/g, "$1 ");
  return t
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((x) => clean(x.replace(/^[-*•\d.)\s]+(?=\S)/, "")))
    .filter((x) => x.length > 3 && !/^(e\.g|i\.e)\.?$/i.test(x));
}

/** Paragraph chunks of at most ~420 characters, for citing. */
export function passages(text: string, max = 420): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    const p = clean(para);
    if (!p) continue;
    if (p.length <= max) {
      out.push(p);
      continue;
    }
    let cur = "";
    for (const s of sentences(p)) {
      if (`${cur} ${s}`.length > max && cur) {
        out.push(cur);
        cur = s;
      } else cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) out.push(cur);
  }
  return out;
}

export const NEED =
  /\b(must|shall|should|needs? to|has to|have to|required to|is required|are required|wants? to|want the ability|be able to)\b/i;
export const NUMBER =
  /\b\d[\d,.]*\s*(%|percent|ms|milliseconds?|s\b|sec(?:onds?)?|minutes?|mins?|hours?|hrs?|days?|weeks?|months?|years?|tps|rps|requests?\/s|users?|\/month|a month|per month|k\b|m\b)/i;
export const OUT_OF_SCOPE =
  /\b(out of scope|not in scope|excluded?|won'?t (?:be )?(?:include|cover|support)|will not (?:include|cover|support)|phase 2|later phase)\b/i;
export const RISK =
  /\b(risk|concern|might fail|may fail|could fail|delay|slip|dependency on|depends on|blocker)\b/i;

/** "Know Your Customer (KYC)" and "KYC (Know Your Customer)". */
export function terms(text: string): { term: string; definition: string }[] {
  const out = new Map<string, string>();
  for (const m of text.matchAll(
    /\b([A-Z][A-Za-z]+(?:[ -][A-Z][A-Za-z]+){1,6})\s*\(([A-Z][A-Z0-9&]{1,9})\)/g,
  )) {
    if (m[1] && m[2]) out.set(m[2], m[1]);
  }
  for (const m of text.matchAll(/\b([A-Z][A-Z0-9&]{1,9})\s*\(([A-Za-z][A-Za-z ,'-]{4,80})\)/g)) {
    if (m[1] && m[2] && !out.has(m[1])) out.set(m[1], m[2]);
  }
  return [...out].map(([term, definition]) => ({ term, definition }));
}

export const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The part of a sentence after its modal verb: "Merchants must be able to download X" → "download X". */
export function afterNeed(sentence: string): string {
  const m = NEED.exec(sentence);
  if (!m) return sentence;
  return clean(sentence.slice(m.index + m[0].length)).replace(/^(be able to|the ability to|to|be)\s+/i, "");
}

/** A short title from a sentence: the action after the modal verb, at most ~7 words. */
export function shortTitle(sentence: string): string {
  const words = afterNeed(sentence)
    .replace(/[.;:,].*$/, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 7);
  return titleCase(words.join(" ")) || titleCase(sentence.split(" ").slice(0, 6).join(" "));
}

/** Subject of a requirement sentence, e.g. "Customers" in "Customers must be able to…". */
export function actorOf(sentence: string): string {
  const m = NEED.exec(sentence);
  const before = m ? sentence.slice(0, m.index).trim() : "";
  const words = before.replace(/^(the|all|our|every|each)\s+/i, "").split(" ");
  const actor = words
    .slice(-3)
    .join(" ")
    .replace(/[^A-Za-z -]/g, "")
    .trim();
  if (!actor || /^(it|we|this|there|which|that|i|you)$/i.test(actor)) return "System";
  return titleCase(actor);
}

export const priorityOf = (sentence: string): "must" | "should" | "could" =>
  /\b(must|shall|required|has to|have to|needs? to)\b/i.test(sentence)
    ? "must"
    : /\b(should|wants? to)\b/i.test(sentence)
      ? "should"
      : "could";

/** "The system shall …" phrasing for a requirement sentence. */
export function asStatement(sentence: string): string {
  const s = clean(sentence).replace(/\.$/, "");
  const replaced = s.replace(/\b(must|needs? to|has to|have to|should|wants? to)\b/i, (m) =>
    /should|want/i.test(m) ? "should" : "shall",
  );
  return `${titleCase(replaced)}.`;
}

/** Splits a list the author typed: lines, semicolons or bullets. Commas only when there are no other separators. */
export function listItems(text: string): string[] {
  const parts = /[\n;•]/.test(text) ? text.split(/[\n;•]+/) : text.split(/,\s+(?=[A-Za-z])/);
  return parts
    .map((x) => clean(x.replace(/^[-*\d.)\s]+/, "")).replace(/\.$/, ""))
    .filter((x) => x.length > 1);
}

/** The measurable part of a target sentence: "within 2 seconds at p95", "by 10:00 IST", "99.9%". */
export function targetPhrase(text: string): string {
  const phrase = text.match(
    /\b(within|in under|under|less than|at least|no more than|by|every|at most|above|below)\s+.*?\d.*?(?=[.;]?\s*$|[,;]\s)/i,
  );
  if (phrase) return clean(phrase[0]);
  const pct = text.match(/\d[\d.]*\s*%/);
  if (pct) return pct[0];
  const unit = text.match(NUMBER);
  return unit ? clean(unit[0]) : "";
}

/** Pulls "from A to B" or the first two numbers from a sentence. */
export function baselineTarget(text: string): { baseline: string; target: string } {
  const m = text.match(/from\s+([^,;]+?)\s+to\s+([^,;.]+(?:\s(?:a|per)\s\w+)?)/i);
  if (m?.[1] && m[2]) return { baseline: clean(m[1]), target: clean(m[2]) };
  // "Median first response is 9.5 hours; we want under 2 hours."
  const now = text.match(
    /\b(?:is|are|takes?|averages?)\s+(?:about\s+|around\s+)?([^,;]*?\d[^,;]*?)\s*[;,]\s*(?:and\s+)?(?:we|i)\s+(?:want|need|aim|target)\s+(?:it\s+)?(?:to\s+be\s+)?([^,;.]*\d[^,;.]*)/i,
  );
  if (now?.[1] && now[2]) return { baseline: clean(now[1]), target: clean(now[2]) };
  return { baseline: "Not measured yet", target: targetPhrase(text) };
}

/** Objective wording: "We want to reduce X from A to B" → statement, KPI and numbers. */
export function objectiveFrom(sentence: string) {
  const s = clean(sentence)
    .replace(/\.$/, "")
    .replace(
      /^(we|i|the business|the goal is to|our goal is to)\s+(want|need|aim|plan|would like|hope)?\s*(to\s+)?/i,
      "",
    );
  const { baseline, target } = baselineTarget(s);
  // "Median first response is 9.5 hours; we want under 2 hours" → KPI "Median first response".
  const current = s.match(/^(.+?)\s+(?:is|are|takes?|averages?)\s+[^;,]*\d[^;,]*[;,]/i);
  if (current?.[1]) {
    const k = titleCase(clean(current[1]));
    return { statement: `${k} ${target}`, kpi: k, baseline, target };
  }
  const kpi = clean(
    s
      .replace(/^(reduce|cut|increase|improve|grow|lower|raise|decrease)\s+/i, "")
      .replace(/\s+(from|to|by|below|under)\b.*$/i, ""),
  );
  return { statement: titleCase(s), kpi: titleCase(kpi || s), baseline, target };
}

export const nfrCategory = (s: string) =>
  /availab|uptime|downtime/i.test(s)
    ? ("availability" as const)
    : /latenc|response|second|ms\b|fast|throughput|per second|tps|rps/i.test(s)
      ? ("performance" as const)
      : /secur|encrypt|mfa|auth|access|pii|privacy/i.test(s)
        ? ("security" as const)
        : /complian|regulat|rbi|gdpr|pci|audit|residen/i.test(s)
          ? ("compliance" as const)
          : /report|dashboard/i.test(s)
            ? ("reporting" as const)
            : /retention|retain|backup|data/i.test(s)
              ? ("data" as const)
              : ("usability" as const);

/** A short document title from the author's first message: "Merchant settlement reports". */
export function titleFrom(message: string): string {
  const first = clean(message.split(/(?<=[.!?])\s|\n/)[0] ?? "");
  const core = first
    .replace(/^(hi|hello|hey)[,!.\s]+/i, "")
    .replace(
      /^(i|we)\s+(want|need|would like|'d like|have)\s+(to\s+)?(write|create|build|draft|make|start|do)?\s*(?:(an|a|the)\s+)?(brd|business requirements? (document|doc)|requirements?|doc(ument)?)?\s*(for|about|on|to)?\s*/i,
      "",
    )
    .replace(/^(brd|requirements?)\s+(for|about|on)\s+/i, "")
    .replace(/^(we|they|customers?|users?|merchants?)\s+(can't|cannot|can not)\s+/i, (m) => m)
    .replace(/[.!?:;,]+$/, "");
  // Up to the first clause break, at most 8 words, never ending on a joining word.
  const words = (core.split(/[,;:]\s|\s[-–—]\s/)[0] ?? core).split(" ").filter(Boolean).slice(0, 8);
  while (words.length > 2 && /^(and|or|to|the|of|for|a|an|in|on|with|that)$/i.test(words.at(-1) ?? ""))
    words.pop();
  const t = titleCase(words.join(" ").replace(/[.!?:;,]+$/, ""));
  return t.length >= 3 ? t : "Untitled BRD";
}

const VERB_S = /^(\w+?)(ies|es|s)\b/;
/** "classifies every email" → "classify every email". */
export function toBase(phrase: string): string {
  const p = clean(phrase);
  const m = p.match(VERB_S);
  if (!m?.[1] || !m[2]) return p;
  const verb =
    m[2] === "ies"
      ? `${m[1]}y`
      : /(sh|ch|x|ss|z)$/.test(m[1]) && m[2] === "es"
        ? m[1]
        : m[2] === "es"
          ? `${m[1]}e`
          : m[1];
  return `${verb}${p.slice(m[0].length)}`;
}

export type BriefParts = {
  summary: string;
  problem: string[];
  objectives: string[];
  requirements: string[];
  rules: string[];
  outOfScope: string[];
};

const CAPS =
  /^(?:(?:we|i)\s+(?:need|want|would like)\s+)?(?:an?\s+|the\s+)?(.+?)\s+(?:that|which|to)\s+(.+)$/i;

/**
 * Reads a free-text brief like a BA would: the current-state numbers become the problem, "we want
 * X" with a number becomes an objective, a list of capabilities ("listens…, classifies… and drafts…")
 * becomes one requirement each, and "always / never" clauses become business rules.
 */
export function briefParts(text: string, isOutOfScope: (s: string) => boolean): BriefParts {
  const ss = sentences(text).map((x) => clean(x).replace(/\.$/, ""));
  const out: BriefParts = {
    summary: ss.slice(0, 3).join(". "),
    problem: [],
    objectives: [],
    requirements: [],
    rules: [],
    outOfScope: [],
  };
  for (const s of ss) {
    if (isOutOfScope(s)) {
      out.outOfScope.push(s);
      continue;
    }
    const hasNumber = /\d/.test(s);
    const wants = /\b(reduce|cut|increase|improve|grow|lower|raise|want|target|aim|goal)\b/i.test(s);
    if (
      hasNumber &&
      /\b(today|currently|median|average|takes|is|are|per (day|week|month)|a (day|week|month))\b/i.test(s)
    )
      out.problem.push(s);
    if (hasNumber && wants) {
      out.objectives.push(s);
      continue;
    }
    if (
      /\b(problem|manual|by hand|complain|slow|delay|can't|cannot|no way)\b/i.test(s) &&
      !out.problem.includes(s)
    )
      out.problem.push(s);
    // Clauses: "Agents must approve replies, and complaints must always go to a person."
    for (const clause of s.split(/,\s+and\s+|;\s+/)) {
      if (/\b(always|never|only|must not|at all times)\b/i.test(clause)) {
        out.rules.push(clause);
        continue;
      }
      if (!/\b(must|need|needs|should|shall|has to|have to|want)\b/i.test(clause)) continue;
      // "I need a BRD for …" is about the document, not a requirement.
      if (/\b(brd|business requirements? (document|doc)|requirements? doc(ument)?)\b/i.test(clause)) continue;
      const caps = clause.match(CAPS);
      const list = caps?.[2]?.split(/,\s+(?:and\s+)?|\s+and\s+(?=\w+s\b)/) ?? [];
      if (caps?.[1] && list.length >= 2 && list.every((x) => VERB_S.test(x))) {
        const who = caps[1].replace(/^(?:an?|the)\s+/i, "");
        for (const x of list) out.requirements.push(`The ${who} must ${toBase(x)}`);
      } else out.requirements.push(clause);
    }
  }
  return out;
}
