import {
  type Anchor,
  BRD_STEPS,
  type BrdContent,
  type BrdSource,
  type BrdStepId,
  type BusinessRequirement,
  type Capture,
  type ChatMessage,
  checkBrd,
  type Proposal,
  stepChecks,
  stepForFocus,
  stepOf,
} from "@throughline/contracts";
import { applyProposal, nextId } from "./apply";
import { KIND_LABEL as REWRITE_LABEL, rewrite, rewriteKind } from "./rewrite";
import {
  actorOf,
  asStatement,
  baselineTarget,
  briefParts,
  clean,
  listItems,
  NEED,
  NUMBER,
  nfrCategory,
  OUT_OF_SCOPE,
  objectiveFrom,
  priorityOf,
  RISK,
  sentences,
  shortTitle,
  terms,
  titleCase,
} from "./text";

/**
 * The simulated BA agent. It interviews the author section by section, turns answers and reference
 * material into proposed edits (never silent changes), cites the passages it used, and always ends
 * with the next most useful question. A model-backed agent replaces this behind the same contract:
 * message in, reply with proposals and a follow-up question out.
 */

type Ctx = {
  content: BrdContent;
  sources: BrdSource[];
  focus: string | null;
  /** Proposals from earlier turns the author hasn't decided on yet. */
  pending: Proposal[];
  seq: () => number;
  step: string | null;
  skipped: string[];
  /** Edits are applied to the document as soon as the agent replies (live editing). */
  live: boolean;
};

type Reply = {
  text: string;
  proposals: Proposal[];
  cites: string[];
  suggestions: string[];
  focus: string | null;
};

const VAGUE: [RegExp, string][] = [
  [/\b(as soon as possible|asap|immediately)\b/gi, "within 15 minutes"],
  [/\b(quickly|fast|rapidly|promptly)\b/gi, "within 2 seconds at p95"],
  [/\b(user-friendly|easy|easily|intuitive|simple)\b/gi, "in no more than 3 steps"],
  [/\b(seamless(ly)?)\b/gi, "without re-entering any data"],
  [/\b(robust|reliable)\b/gi, "with 99.9% success over a month"],
  [/\b(minimal|minimum)\b/gi, "at most 1"],
];

const MAX_FROM_SOURCE = 6;

function proposal(ctx: Ctx, p: Omit<Proposal, "id" | "status">): Proposal {
  return { ...p, id: `P${ctx.seq()}`, status: "pending" };
}

const takenIds = (ctx: Ctx, target: string) => [
  ...((ctx.content as unknown as Record<string, { id?: string }[]>)[target] ?? []).map((r) =>
    String(r.id ?? ""),
  ),
  ...ctx.pending
    .filter((p) => p.target === target && p.op === "add-row")
    .map((p) => String((p.value as { id?: string }).id ?? "")),
];

/** Holds an id so later proposals in the same reply don't reuse it. */
function reserve(ctx: Ctx, target: string, id: string) {
  ctx.pending.push({
    id: "tmp",
    op: "add-row",
    target,
    rowId: null,
    value: { id },
    cites: [],
    summary: "",
    status: "pending",
  });
}

/* ── Building proposals ─────────────────────────────────────────────────────────────────────── */

function requirementFrom(ctx: Ctx, sentence: string, cites: string[], area?: string): Proposal {
  const id = nextId("BR-", takenIds(ctx, "requirements"));
  ctx.pending.push({
    id: "tmp",
    op: "add-row",
    target: "requirements",
    rowId: null,
    value: { id },
    cites: [],
    summary: "",
    status: "pending",
  });
  const actor = actorOf(sentence);
  const req: BusinessRequirement = {
    id,
    title: shortTitle(sentence),
    statement: asStatement(sentence),
    rationale: "",
    priority: priorityOf(sentence),
    area: area ?? ctx.content.requirements.at(-1)?.area ?? "Core capability",
    actor,
    objective: ctx.content.objectives[0]?.id ?? "",
    source: cites.length ? `Reference ${cites.join(", ")}` : "Conversation with the author",
    acceptance: NUMBER.test(sentence) ? [clean(sentence).replace(/\.$/, "")] : [],
    sources: cites,
  };
  return proposal(ctx, {
    op: "add-row",
    target: "requirements",
    rowId: null,
    value: req,
    cites,
    summary: `Add ${id} · ${req.title} (${req.priority})`,
  });
}

function fromSources(ctx: Ctx, ids: string[]): Reply {
  const chosen = ctx.sources.filter((s) => ids.includes(s.id) && s.status === "ready");
  const unreadable = ctx.sources.filter((s) => ids.includes(s.id) && s.status !== "ready");
  if (chosen.length === 0) {
    return {
      text: unreadable.length
        ? `I can't read ${unreadable.map((s) => s.id).join(", ")} yet: ${unreadable[0]?.summary}`
        : "Attach a document, link or note first (the + in the message box), then tell me which one to use, e.g. “use S1 for requirements”.",
      proposals: [],
      cites: [],
      suggestions: [],
      focus: ctx.focus,
    };
  }
  const proposals: Proposal[] = [];
  const cites = new Set<string>();
  // Don't add what the document (or a waiting suggestion) already says, e.g. when a source is used twice.
  const k = (t: string) =>
    clean(t)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const seen = new Set<string>([
    ...ctx.content.requirements.map((r) => k(r.statement)),
    ...ctx.content.nfrs.map((n) => k(n.statement)),
    ...ctx.content.outOfScope.map(k),
    ...ctx.content.risks.map((r) => k(r.description)),
    ...ctx.pending.flatMap((x) => {
      const v = x.value as { statement?: unknown; description?: unknown } | unknown[] | null;
      if (Array.isArray(v)) return v.filter((t): t is string => typeof t === "string").map(k);
      const t = v && typeof v === "object" ? (v.statement ?? v.description) : null;
      return typeof t === "string" ? [k(t)] : [];
    }),
  ]);
  const fresh = (t: string) => {
    if (seen.has(k(t))) return false;
    seen.add(k(t));
    return true;
  };
  let reqs = 0;
  for (const src of chosen) {
    for (const p of src.passages) {
      for (const s of sentences(p.text)) {
        if (OUT_OF_SCOPE.test(s)) {
          if (!fresh(s)) continue;
          proposals.push(
            proposal(ctx, {
              op: "add-items",
              target: "outOfScope",
              rowId: null,
              value: [clean(s)],
              cites: [p.id],
              summary: `Out of scope: ${clean(s).slice(0, 70)}`,
            }),
          );
          cites.add(p.id);
        } else if (NEED.test(s) && reqs < MAX_FROM_SOURCE && fresh(asStatement(s).replace(/\.$/, ""))) {
          if (
            NUMBER.test(s) &&
            /availab|uptime|latenc|response time|within \d|secure|encrypt|retain|retention|residen/i.test(s)
          ) {
            const id = nextId("NFR-", takenIds(ctx, "nfrs"));
            ctx.pending.push({
              id: "tmp",
              op: "add-row",
              target: "nfrs",
              rowId: null,
              value: { id },
              cites: [],
              summary: "",
              status: "pending",
            });
            proposals.push(
              proposal(ctx, {
                op: "add-row",
                target: "nfrs",
                rowId: null,
                value: {
                  id,
                  category: nfrCategory(s),
                  statement: asStatement(s).replace(/\.$/, ""),
                  target: baselineTarget(s).target || clean(s),
                  sources: [p.id],
                },
                cites: [p.id],
                summary: `Add ${id} (${nfrCategory(s)}): ${clean(s).slice(0, 60)}`,
              }),
            );
          } else {
            proposals.push(requirementFrom(ctx, s, [p.id]));
            reqs++;
          }
          cites.add(p.id);
        } else if (RISK.test(s) && proposals.filter((x) => x.target === "risks").length < 2 && fresh(s)) {
          const id = nextId("R-", takenIds(ctx, "risks"), 1);
          ctx.pending.push({
            id: "tmp",
            op: "add-row",
            target: "risks",
            rowId: null,
            value: { id },
            cites: [],
            summary: "",
            status: "pending",
          });
          proposals.push(
            proposal(ctx, {
              op: "add-row",
              target: "risks",
              rowId: null,
              value: {
                id,
                description: clean(s),
                impact: "medium",
                likelihood: "medium",
                mitigation: "",
                owner: "",
                sources: [p.id],
              },
              cites: [p.id],
              summary: `Add risk ${id}: ${clean(s).slice(0, 60)}`,
            }),
          );
          cites.add(p.id);
        }
      }
    }
    const known = new Set(ctx.content.glossary.map((g) => g.term.toLowerCase()));
    for (const t of terms(src.passages.map((p) => p.text).join("\n"))
      .filter((t) => !known.has(t.term.toLowerCase()))
      .slice(0, 4)) {
      proposals.push(
        proposal(ctx, {
          op: "add-row",
          target: "glossary",
          rowId: null,
          value: t,
          cites: [src.id],
          summary: `Glossary: ${t.term} = ${t.definition}`,
        }),
      );
    }
  }
  const counts = (t: string) => proposals.filter((p) => p.target === t).length;
  const parts = [
    counts("requirements") && `${counts("requirements")} requirement${counts("requirements") > 1 ? "s" : ""}`,
    counts("nfrs") && `${counts("nfrs")} quality target${counts("nfrs") > 1 ? "s" : ""}`,
    counts("outOfScope") && `${counts("outOfScope")} out-of-scope item${counts("outOfScope") > 1 ? "s" : ""}`,
    counts("risks") && `${counts("risks")} risk${counts("risks") > 1 ? "s" : ""}`,
    counts("glossary") && `${counts("glossary")} glossary term${counts("glossary") > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return {
    text: proposals.length
      ? `From ${chosen.map((s) => `${s.id} “${s.title}”`).join(" and ")} I found ${parts.join(", ")}. ${ctx.live ? "They're in the document now, each citing the passage it came from; undo any that aren't right." : "Each one cites the passage it came from; accept the ones that are right."} New requirements need acceptance criteria next.`
      : seen.size > 0 &&
          chosen.some((s) => s.passages.some((p) => sentences(p.text).some((x) => NEED.test(x))))
        ? `Everything I can take from ${chosen.map((s) => s.id).join(", ")} is already in the document. Point me at a passage, or tell me what's missing.`
        : `I read ${chosen.map((s) => s.id).join(", ")} but found no statements of need (“must”, “should”, “needs to”) or targets. Tell me what to take from it.`,
    proposals,
    cites: [...cites],
    suggestions: proposals.length
      ? ctx.live
        ? ["What's still missing?"]
        : ["Accept all", "What's still missing?"]
      : [],
    focus: ctx.focus,
  };
}

function makeTestable(ctx: Ctx, id: string): Reply {
  const r = ctx.content.requirements.find((x) => x.id === id);
  if (!r)
    return {
      text: `There's no ${id} in this BRD.`,
      proposals: [],
      cites: [],
      suggestions: [],
      focus: ctx.focus,
    };
  let changed = false;
  const fix = (s: string) =>
    VAGUE.reduce((acc, [re, rep]) => {
      const out = acc.replace(re, rep);
      if (out !== acc) changed = true;
      return out;
    }, s);
  const statement = fix(r.statement);
  let acceptance = r.acceptance.map(fix);
  if (acceptance.length === 0) {
    changed = true;
    acceptance = [
      `${r.actor} can ${clean(r.title.toLowerCase().replace(/\b(quickly|fast|rapidly|promptly|easily|seamlessly|immediately|asap)\b/g, ""))} in no more than 3 steps`,
      "The outcome is visible within 1 minute",
      "Failures show a reason and are recorded for follow-up",
    ];
  }
  if (!changed) {
    return {
      text: `${id} is already measurable. If a number is wrong, edit it directly in the document.`,
      proposals: [],
      cites: [],
      suggestions: ["What's still missing?"],
      focus: ctx.focus,
    };
  }
  return {
    text: `Here's ${id} with every vague phrase replaced by a measurable target. The numbers are placeholders: change them to your real targets before approval.`,
    proposals: [
      proposal(ctx, {
        op: "update-row",
        target: "requirements",
        rowId: id,
        value: { statement, acceptance },
        cites: [],
        summary: `Make ${id} testable`,
      }),
    ],
    cites: [],
    suggestions: ["Make every requirement testable", "What's still missing?"],
    focus: ctx.focus,
  };
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{4,}/g) ?? []);
function overlap(a: string, b: string) {
  const x = words(a);
  const y = words(b);
  if (!x.size || !y.size) return 0;
  let n = 0;
  for (const w of x) if (y.has(w)) n++;
  return n / Math.min(x.size, y.size);
}

/** Objective whose wording is closest to the text, if any is reasonably close. */
function bestObjective(c: BrdContent, text: string) {
  const ranked = c.objectives
    .map((o) => ({ o, score: overlap(`${o.statement} ${o.kpi}`, text) }))
    .sort((a, b) => b.score - a.score);
  return ranked[0] && ranked[0].score > 0 ? ranked[0].o : c.objectives[0];
}

/** Reviews one requirement like a senior BA: testability, traceability, rationale, size and duplicates. */
function refine(ctx: Ctx, id: string): Reply {
  const r = ctx.content.requirements.find((x) => x.id === id);
  if (!r)
    return {
      text: `There's no ${id} in this BRD.`,
      proposals: [],
      cites: [],
      suggestions: [],
      focus: ctx.focus,
    };
  const notes: string[] = [];
  const testable = makeTestable(ctx, id);
  const proposals = [...testable.proposals];
  if (testable.proposals.length)
    notes.push(
      r.acceptance.length
        ? "It uses vague words without a number; I've proposed measurable wording."
        : "It has no acceptance criteria; I've proposed three you can edit.",
    );
  const objectiveIds = new Set(ctx.content.objectives.map((o) => o.id));
  if (!objectiveIds.has(r.objective)) {
    const best = bestObjective(ctx.content, `${r.title} ${r.statement}`);
    if (best) {
      proposals.push(
        proposal(ctx, {
          op: "update-row",
          target: "requirements",
          rowId: id,
          value: { objective: best.id },
          cites: [],
          summary: `Link ${id} to ${best.id}`,
        }),
      );
      notes.push(`It isn't linked to an objective; ${best.id} “${best.statement.slice(0, 60)}” fits best.`);
    } else notes.push("There are no objectives to trace it to yet (Problem & outcomes step).");
  }
  if (!r.rationale.trim())
    notes.push("It has no rationale: say why it matters (“so that …”) in the document.");
  if (/\band\b.*\b(shall|must|should|be able to)\b/i.test(r.statement) || r.statement.length > 260)
    notes.push(
      "It reads like more than one requirement; consider splitting it so each can be tested and estimated.",
    );
  const twin = ctx.content.requirements.find((x) => x.id !== id && overlap(x.statement, r.statement) > 0.75);
  if (twin)
    notes.push(`It overlaps heavily with ${twin.id} “${twin.title}”; merge or sharpen the difference.`);
  if (r.priority === "must" && !r.source.trim())
    notes.push("A Must with no source is hard to defend; note who asked for it.");
  return {
    text: notes.length
      ? `Review of ${id} “${r.title}”:\n${notes.map((n) => `• ${n}`).join("\n")}`
      : `${id} looks solid: testable, traced to ${r.objective}, with a rationale.`,
    proposals,
    cites: [],
    suggestions: [],
    focus: ctx.focus,
  };
}

const TEXT_SECTIONS: Record<string, "summary" | "problem" | "background"> = {
  summary: "summary",
  problem: "problem",
  background: "background",
};
const SECTION_LABEL: Record<string, string> = {
  summary: "executive summary",
  problem: "problem statement",
  background: "background",
};
/** Section id (document) → content keys it holds, for section reviews. */
const SECTION_CHECKS: Record<string, string> = {
  context: "context",
  current: "currentState",
  future: "futureState",
  pain: "painPoints",
  success: "successCriteria",
  questions: "questions",
};

/**
 * A request about a specific part of the document: a selected passage, a section or a row.
 * Returns null when the text is better handled by the general intents (e.g. "add risk: …").
 */
function aboutContext(ctx: Ctx, a: Anchor, text: string): Reply | null {
  const kind = rewriteKind(text);
  const textKey = TEXT_SECTIONS[a.section];
  const reply = (t: string, proposals: Proposal[] = []): Reply => ({
    text: t,
    proposals,
    cites: [],
    suggestions: [],
    focus: ctx.focus,
  });
  if (kind === "expand")
    return reply(
      "I can't add facts I don't have. Tell me what's missing (numbers, who's affected, what triggered this) or attach a source, and I'll work it in with a citation.",
    );
  if (kind && textKey) {
    const before = ctx.content[textKey];
    if (!before.trim())
      return reply(`The ${SECTION_LABEL[textKey]} is empty, so there's nothing to rewrite yet.`);
    const after = rewrite(before, kind, a.quote, textKey === "summary" ? 3 : null);
    if (after === before)
      return reply(
        `The ${a.quote ? "selected passage" : SECTION_LABEL[textKey]} already reads ${REWRITE_LABEL[kind]}; I didn't change it.`,
      );
    return reply(
      `${ctx.live ? `I've made the ${a.quote ? "passage" : SECTION_LABEL[textKey]} ${REWRITE_LABEL[kind]} in the document; undo it here if you prefer the original.` : `Here's the ${a.quote ? "passage" : SECTION_LABEL[textKey]} ${REWRITE_LABEL[kind]}. It's shown as a tracked change in the document.`}${kind === "measurable" ? " The numbers are placeholders: set your real targets." : ""}`,
      [
        proposal(ctx, {
          op: "set-text",
          target: textKey,
          rowId: null,
          value: after,
          cites: [],
          summary: `Rewrite the ${SECTION_LABEL[textKey]} (${REWRITE_LABEL[kind]})`,
        }),
      ],
    );
  }
  if (kind && a.rowId?.startsWith("BR-")) {
    const r = ctx.content.requirements.find((x) => x.id === a.rowId);
    if (!r) return reply(`${a.rowId} is no longer in the document.`);
    if (kind === "measurable") return makeTestable(ctx, r.id);
    const statement = rewrite(r.statement, kind, a.quote && r.statement.includes(a.quote) ? a.quote : null);
    if (statement === r.statement) return reply(`${r.id} already reads ${REWRITE_LABEL[kind]}.`);
    return reply(`Here's ${r.id} ${REWRITE_LABEL[kind]}.`, [
      proposal(ctx, {
        op: "update-row",
        target: "requirements",
        rowId: r.id,
        value: { statement },
        cites: [],
        summary: `Rewrite ${r.id} (${REWRITE_LABEL[kind]})`,
      }),
    ]);
  }
  if (kind && a.section === "requirements" && kind === "measurable") return null; // "make every requirement testable"
  if (
    /\b(review|check|what'?s missing|gaps?|issues?|improve)\b/i.test(text) &&
    !/\bBR-\d+/i.test(text) &&
    !a.rowId
  ) {
    const key = SECTION_CHECKS[a.section] ?? a.section;
    const checks = checkBrd(ctx.content).filter((c) => c.section === a.section || c.section === key);
    const gap = nextGap(ctx.content, ctx.pending, {
      step: stepForFocus(TARGET_OF[a.section] ?? a.section),
      skipped: ctx.skipped,
    });
    return {
      text: checks.length
        ? `${checks.length} open check${checks.length > 1 ? "s" : ""} in this section:\n${checks.map((c) => `- ${c.message}`).join("\n")}${gap ? `\n\n${gap.question}` : ""}`
        : `No quality checks fail in this section.${gap ? ` One thing I'd still add: ${gap.question}` : ""}`,
      proposals: [],
      cites: [],
      suggestions: gap?.suggestions ?? [],
      focus: gap?.focus ?? ctx.focus,
    };
  }
  return null;
}

/** Document section id → the content key the interview uses for it. */
const TARGET_OF: Record<string, string> = {
  scope: "inScope",
  current: "currentState",
  future: "futureState",
  pain: "painPoints",
  success: "successCriteria",
  context: "assumptions",
  questions: "risks",
};

/* ── Interview: what to ask next ────────────────────────────────────────────────────────────── */

type Gap = { focus: string; question: string; suggestions: string[] };

type GapDef = {
  focus: string;
  step: BrdStepId;
  /** Asked in the free-form interview too (not only inside its step). */
  core: boolean;
  /** Can't be skipped: a blocking check depends on it. */
  required: boolean;
  find: (c: BrdContent, pending: Proposal[]) => Gap | null;
};

const proposedFor = (pending: Proposal[], key: string) =>
  pending.some((p) => p.status === "pending" && p.target === key);

const simple = (
  focus: string,
  step: BrdStepId,
  missing: (c: BrdContent) => boolean,
  question: string,
  opts: { core?: boolean; required?: boolean; suggestions?: string[] } = {},
): GapDef => ({
  focus,
  step,
  core: opts.core ?? false,
  required: opts.required ?? false,
  find: (c, pending) =>
    missing(c) && !proposedFor(pending, focus)
      ? { focus, question, suggestions: opts.suggestions ?? [] }
      : null,
});

/** Every question the agent can ask, in interview order. */
const GAPS: GapDef[] = [
  simple(
    "summary",
    "context",
    (c) => c.summary.trim().length < 40,
    "In two or three sentences: what are we doing, for whom, and why now?",
    { core: true, required: true },
  ),
  simple(
    "background",
    "context",
    (c) => c.background.trim().length < 20,
    "Any background the reader needs: history, earlier attempts, regulation, the trigger for doing this now?",
    { suggestions: ["Skip background"] },
  ),
  simple(
    "problem",
    "problem",
    (c) => c.problem.trim().length < 40,
    "What problem does this solve? Numbers help: “2,400 complaints a month”, “3 days to cancel”.",
    { core: true, required: true },
  ),
  simple(
    "objectives",
    "problem",
    (c) => c.objectives.length === 0 || c.objectives.some((o) => !o.target),
    "What outcome makes this a success? Give the measure, today's value and the target, e.g. “cut manual tickets from 1,100 to under 100 a month”.",
    { core: true, required: true },
  ),
  simple(
    "inScope",
    "scope",
    (c) => c.inScope.length === 0,
    "What's in scope? List the capabilities, separated by semicolons or new lines.",
    { core: true, required: true },
  ),
  simple(
    "outOfScope",
    "scope",
    (c) => c.outOfScope.length === 0,
    "What's explicitly out of scope, so nobody assumes it's coming?",
    { core: true, suggestions: ["Nothing is out of scope"] },
  ),
  simple(
    "stakeholders",
    "scope",
    (c) => !c.stakeholders.some((s) => s.raci === "A"),
    "Who is accountable (usually the sponsor), and who must be consulted? e.g. “Anil Kapoor – Head of Payments (A); Meera Iyer – Compliance (C)”.",
    { core: true, required: true },
  ),
  simple(
    "currentState",
    "process",
    (c) => c.currentState.length === 0,
    "How does it work today? One step per line as “Actor: step”.",
    { core: true, suggestions: ["Skip the current process"] },
  ),
  simple(
    "painPoints",
    "process",
    (c) => c.painPoints.length === 0,
    "Where does today's process hurt? One pain point per line, with a number if you have one.",
    { suggestions: ["Skip pain points"] },
  ),
  simple(
    "futureState",
    "process",
    (c) => c.futureState.length === 0,
    "How should it work once this ships? One step per line as “Actor: step”.",
    { suggestions: ["Skip the future process"] },
  ),
  simple(
    "requirements",
    "requirements",
    (c) => c.requirements.length === 0,
    "What must the solution let people do? One need per sentence, e.g. “Customers must be able to cancel a mandate from the app.” I'll turn each into a requirement.",
    { core: true, required: true },
  ),
  {
    focus: "acceptance",
    step: "requirements",
    core: true,
    required: true,
    find: (c, pending) => {
      const r = c.requirements.find(
        (x) =>
          x.priority !== "wont" &&
          x.acceptance.filter((a) => a.trim()).length === 0 &&
          !pending.some((p) => p.rowId === x.id && p.status === "pending"),
      );
      return r
        ? {
            focus: `acceptance:${r.id}`,
            question: `What would prove ${r.id} “${r.title}” works? Give 1–3 checks with numbers where you can.`,
            suggestions: [`Make ${r.id} testable for me`],
          }
        : null;
    },
  },
  simple(
    "rules",
    "requirements",
    (c) => c.rules.length === 0,
    "Any business rules the solution must enforce? Limits, eligibility, approvals, cut-off times. One per line.",
    { suggestions: ["No business rules"] },
  ),
  simple(
    "nfrs",
    "quality",
    (c) => c.nfrs.length === 0,
    "Any quality targets? Availability, response time, security, data residency, retention. One per line.",
    { core: true },
  ),
  simple(
    "data",
    "quality",
    (c) => c.data.length === 0,
    "What data does this create, read or change? One per line as “Entity: what it is”. Say “restricted” for personal or payment data.",
    { suggestions: ["No new data"] },
  ),
  simple(
    "risks",
    "risks",
    (c) => c.risks.length === 0,
    "What could stop this succeeding? One risk per line.",
    { core: true },
  ),
  {
    focus: "mitigation",
    step: "risks",
    core: false,
    required: false,
    find: (c, pending) => {
      const r = c.risks.find(
        (x) => !x.mitigation.trim() && !pending.some((p) => p.rowId === x.id && p.status === "pending"),
      );
      return r
        ? {
            focus: `mitigation:${r.id}`,
            question: `How will we reduce ${r.id} “${r.description.slice(0, 80)}”? Who owns it?`,
            suggestions: ["Skip mitigations"],
          }
        : null;
    },
  },
  simple(
    "assumptions",
    "risks",
    (c) => c.assumptions.length === 0,
    "What are we assuming is true? One per line.",
    { suggestions: ["No assumptions"] },
  ),
  simple(
    "constraints",
    "risks",
    (c) => c.constraints.length === 0,
    "Any constraints: budget, dates, technology, regulation?",
    { suggestions: ["No constraints"] },
  ),
  simple(
    "dependencies",
    "risks",
    (c) => c.dependencies.length === 0,
    "What does this depend on: other teams, vendors, releases?",
    { suggestions: ["No dependencies"] },
  ),
  simple(
    "successCriteria",
    "problem",
    (c) => c.successCriteria.length === 0,
    "How will we know it worked, 90 days after launch?",
    { core: true, suggestions: ["Use the objective targets"] },
  ),
];

const STEP_ORDER = new Map(BRD_STEPS.map((s, i) => [s.id, i]));
const STEP_GAPS = [...GAPS].sort(
  (a, b) =>
    (STEP_ORDER.get(a.step) ?? 0) - (STEP_ORDER.get(b.step) ?? 0) ||
    stepOf(a.step).focuses.indexOf(a.focus) - stepOf(b.step).focuses.indexOf(b.focus),
);

/**
 * The next question. Without a step it runs the core interview in order; inside a step it asks only
 * that step's questions, including optional ones the author hasn't skipped.
 */
export function nextGap(
  c: BrdContent,
  pending: Proposal[],
  opts: { step?: string | null; skipped?: string[] } = {},
): Gap | null {
  const skipped = new Set(opts.skipped ?? []);
  const list = opts.step
    ? STEP_GAPS.filter((g) => g.step === opts.step && (g.required || !skipped.has(g.focus)))
    : GAPS.filter((g) => g.core);
  for (const g of list) {
    const gap = g.find(c, pending);
    if (gap) return gap;
  }
  return null;
}

/** Whether the author may skip the question about this focus. */
export const canSkip = (focus: string) => {
  const key = focus.split(":")[0] ?? focus;
  return !GAPS.find((g) => g.focus === key)?.required;
};

function withNext(ctx: Ctx, reply: Reply, allPending: Proposal[]): Reply {
  const gap = nextGap(ctx.content, allPending, { step: ctx.step, skipped: ctx.skipped });
  if (!gap) {
    if (ctx.step === "review") return { ...reply, focus: null };
    if (ctx.step) {
      const step = stepOf(ctx.step);
      const missing = stepChecks(step.id, ctx.content).filter((x) => !x.ok);
      const next = BRD_STEPS[BRD_STEPS.indexOf(step) + 1];
      const pendingHere = ctx.live ? 0 : allPending.filter((p) => p.status === "pending").length;
      const status = pendingHere
        ? `Decide on the ${pendingHere} proposed edit${pendingHere > 1 ? "s" : ""} above to finish ${step.title}.`
        : missing.length
          ? `${step.title} still has ${missing.length} open check${missing.length > 1 ? "s" : ""}: ${missing.map((x) => x.label.toLowerCase()).join("; ")}. Use the form or edit the document directly.`
          : `${step.title} meets every exit check.${next ? ` Next: ${next.title}.` : ""}`;
      return {
        ...reply,
        text: `${reply.text}\n\n${status}`.trim(),
        suggestions: reply.suggestions.length
          ? reply.suggestions
          : next && !missing.length
            ? [`Go to ${next.title}`]
            : [],
        focus: null,
      };
    }
    const errors = checkBrd(ctx.content).filter((c) => c.severity === "error").length;
    return {
      ...reply,
      text: `${reply.text}\n\nEvery section has content. ${errors ? `${errors} blocking check${errors > 1 ? "s" : ""} left: see Quality.` : "No blocking checks: review it and submit for approval."}`.trim(),
      suggestions: reply.suggestions.length
        ? reply.suggestions
        : ["What's still missing?", "Make every requirement testable"],
      focus: null,
    };
  }
  const skip =
    canSkip(gap.focus) && !gap.suggestions.some((x) => /^(skip|no |nothing)/i.test(x)) ? ["Skip this"] : [];
  return {
    ...reply,
    text: `${reply.text}\n\n${gap.question}`.trim(),
    suggestions: [...reply.suggestions, ...gap.suggestions, ...(ctx.step ? skip : [])].slice(0, 3),
    focus: gap.focus,
  };
}

/* ── Answers to the question the agent asked ───────────────────────────────────────────────── */

function answer(ctx: Ctx, focus: string, text: string): Proposal[] {
  const t = text.trim();
  const items = listItems(t);
  const single = (target: string, value: unknown, summary: string, op: Proposal["op"] = "set-text") => [
    proposal(ctx, { op, target, rowId: null, value, cites: [], summary }),
  ];
  if (/^(skip|no |nothing|none|n\/a)/i.test(t) && focus !== "outOfScope") return [];
  if (focus === "summary" || focus === "problem" || focus === "background")
    return single(focus, clean(t), `Write the ${focus === "summary" ? "executive summary" : focus}`);
  if (
    focus === "inScope" ||
    focus === "painPoints" ||
    focus === "outOfScope" ||
    focus === "successCriteria" ||
    focus === "assumptions" ||
    focus === "constraints" ||
    focus === "dependencies"
  ) {
    if (/^(nothing|none|n\/a|skip)/i.test(t))
      return focus === "outOfScope"
        ? single(
            focus,
            ["Nothing beyond the in-scope list; anything not listed there is out"],
            "Out of scope: nothing beyond the list",
            "add-items",
          )
        : [];
    if (focus === "successCriteria" && /objective/i.test(t))
      return single(
        focus,
        ctx.content.objectives.map((o) => `${o.statement}: ${o.target}`),
        "Success = objective targets met",
        "add-items",
      );
    return single(
      focus,
      items,
      `Add ${items.length} item${items.length > 1 ? "s" : ""} to ${focus.replace(/([A-Z])/g, " $1").toLowerCase()}`,
      "add-items",
    );
  }
  if (focus === "objectives") {
    return sentences(t).map((s) => {
      const id = nextId("OBJ-", takenIds(ctx, "objectives"), 1);
      ctx.pending.push({
        id: "tmp",
        op: "add-row",
        target: "objectives",
        rowId: null,
        value: { id },
        cites: [],
        summary: "",
        status: "pending",
      });
      const o = objectiveFrom(s);
      return proposal(ctx, {
        op: "add-row",
        target: "objectives",
        rowId: null,
        value: { id, ...o },
        cites: [],
        summary: `Add ${id}: ${o.statement.slice(0, 70)}`,
      });
    });
  }
  if (focus === "stakeholders") {
    return items.map((it) => {
      const raci = (it.match(/\(([RACI])\)/i)?.[1]?.toUpperCase() ??
        (/sponsor|accountable|head|director/i.test(it) ? "A" : "C")) as "R" | "A" | "C" | "I";
      const [name = it, role = ""] = it.replace(/\(([RACI])\)/i, "").split(/\s+[-–—,:]\s+/);
      return proposal(ctx, {
        op: "add-row",
        target: "stakeholders",
        rowId: null,
        value: { name: clean(name), role: clean(role) || "Stakeholder", raci, interest: "" },
        cites: [],
        summary: `Add stakeholder ${clean(name)} (${raci})`,
      });
    });
  }
  if (focus === "currentState" || focus === "futureState") {
    if (/^skip/i.test(t)) return [];
    return items.map((it) => {
      const [actor, ...rest] = it.includes(":") ? it.split(":") : ["Team", it];
      return proposal(ctx, {
        op: "add-row",
        target: focus,
        rowId: null,
        value: { actor: clean(actor ?? "Team"), step: clean(rest.join(":")) },
        cites: [],
        summary: `Add step: ${it.slice(0, 60)}`,
      });
    });
  }
  if (focus === "requirements") return sentences(t).map((s) => requirementFrom(ctx, s, []));
  if (focus === "rules") {
    return items.map((it) => {
      const id = nextId("RULE-", takenIds(ctx, "rules"));
      reserve(ctx, "rules", id);
      return proposal(ctx, {
        op: "add-row",
        target: "rules",
        rowId: null,
        value: { id, statement: asStatement(it).replace(/\.$/, ""), source: "Conversation with the author" },
        cites: [],
        summary: `Add ${id}: ${it.slice(0, 60)}`,
      });
    });
  }
  if (focus === "data") {
    return items.map((it) => {
      const [entity = it, ...rest] = it.split(/\s*[:–-]\s+/);
      const restricted = /restricted|personal|pii|card|account|payment|aadhaar|pan\b|kyc/i.test(it);
      return proposal(ctx, {
        op: "add-row",
        target: "data",
        rowId: null,
        value: {
          entity: titleCase(clean(entity.replace(/\(?restricted\)?/i, ""))),
          description: clean(rest.join(" ")) || clean(entity),
          classification: restricted ? "restricted" : "internal",
          retention: "To be confirmed",
        },
        cites: [],
        summary: `Add data: ${clean(entity).slice(0, 50)}${restricted ? " (restricted)" : ""}`,
      });
    });
  }
  if (focus.startsWith("mitigation:")) {
    const id = focus.split(":")[1] ?? "";
    const owner = t.match(/\b(?:owner|owned by|by)\s*[:-]?\s*([A-Z][\w. ]{1,40})$/)?.[1] ?? "";
    return [
      proposal(ctx, {
        op: "update-row",
        target: "risks",
        rowId: id,
        value: {
          mitigation: clean(t.replace(/\b(?:owner|owned by)\s*[:-]?.*$/i, "")).replace(/[.;,]$/, ""),
          ...(owner ? { owner: clean(owner) } : {}),
        },
        cites: [],
        summary: `Mitigation for ${id}`,
      }),
    ];
  }
  if (focus.startsWith("acceptance:")) {
    const id = focus.split(":")[1] ?? "";
    const r = ctx.content.requirements.find((x) => x.id === id);
    if (!r) return [];
    return [
      proposal(ctx, {
        op: "update-row",
        target: "requirements",
        rowId: id,
        value: { acceptance: [...r.acceptance, ...items] },
        cites: [],
        summary: `Add ${items.length} acceptance criteria to ${id}`,
      }),
    ];
  }
  if (focus === "nfrs") {
    return items.map((it) => {
      const id = nextId("NFR-", takenIds(ctx, "nfrs"));
      ctx.pending.push({
        id: "tmp",
        op: "add-row",
        target: "nfrs",
        rowId: null,
        value: { id },
        cites: [],
        summary: "",
        status: "pending",
      });
      return proposal(ctx, {
        op: "add-row",
        target: "nfrs",
        rowId: null,
        value: {
          id,
          category: nfrCategory(it),
          statement: titleCase(it.replace(/[:–-]?\s*[<>≤≥]?\s*\d.*$/, "") || it),
          target: baselineTarget(it).target || it,
        },
        cites: [],
        summary: `Add ${id} (${nfrCategory(it)}): ${it.slice(0, 60)}`,
      });
    });
  }
  if (focus === "risks") {
    return items.map((it) => {
      const id = nextId("R-", takenIds(ctx, "risks"), 1);
      ctx.pending.push({
        id: "tmp",
        op: "add-row",
        target: "risks",
        rowId: null,
        value: { id },
        cites: [],
        summary: "",
        status: "pending",
      });
      return proposal(ctx, {
        op: "add-row",
        target: "risks",
        rowId: null,
        value: {
          id,
          description: titleCase(it),
          impact: /critical|regulat|outage|fine/i.test(it) ? "high" : "medium",
          likelihood: "medium",
          mitigation: "",
          owner: "",
        },
        cites: [],
        summary: `Add risk ${id}: ${it.slice(0, 60)}`,
      });
    });
  }
  return [];
}

/** First pass from a free-text brief: summary, problem, objectives and requirements in one go. */
function draftFromBrief(ctx: Ctx, text: string): Proposal[] {
  const b = briefParts(text, (x) => OUT_OF_SCOPE.test(x));
  const out: Proposal[] = [];
  if (ctx.content.summary.trim().length < 40 && b.summary)
    out.push(
      proposal(ctx, {
        op: "set-text",
        target: "summary",
        rowId: null,
        value: `${b.summary}.`,
        cites: [],
        summary: "Draft the executive summary",
      }),
    );
  if (b.problem.length && ctx.content.problem.trim().length < 40)
    out.push(
      proposal(ctx, {
        op: "set-text",
        target: "problem",
        rowId: null,
        value: `${b.problem.slice(0, 3).join(". ")}.`,
        cites: [],
        summary: "Draft the problem statement",
      }),
    );
  for (const s of b.objectives.slice(0, 3)) out.push(...answer(ctx, "objectives", s));
  for (const s of b.requirements.slice(0, MAX_FROM_SOURCE)) out.push(requirementFrom(ctx, s, []));
  for (const s of b.rules) {
    const id = nextId("RULE-", takenIds(ctx, "rules"));
    reserve(ctx, "rules", id);
    out.push(
      proposal(ctx, {
        op: "add-row",
        target: "rules",
        rowId: null,
        value: { id, statement: asStatement(s).replace(/\.$/, ""), source: "Conversation with the author" },
        cites: [],
        summary: `Add ${id}: ${s.slice(0, 60)}`,
      }),
    );
  }
  for (const s of b.outOfScope)
    out.push(
      proposal(ctx, {
        op: "add-items",
        target: "outOfScope",
        rowId: null,
        value: [clean(s)],
        cites: [],
        summary: `Out of scope: ${s.slice(0, 60)}`,
      }),
    );
  return out;
}

/* ── Entry point ────────────────────────────────────────────────────────────────────────────── */

export function respond(
  input: {
    content: BrdContent;
    sources: BrdSource[];
    focus: string | null;
    pending: Proposal[];
    nextSeq: number;
    step?: string | null;
    skipped?: string[];
    live?: boolean;
  },
  text: string,
  opts: {
    /** Sources attached to the message. */
    attachments?: string[];
    /** Part of the document the message is about (a block, a row, a selection). */
    context?: Anchor | null;
    /** Follow up with the next interview question (off for comment replies). */
    interview?: boolean;
  } = {},
): { message: Omit<ChatMessage, "id" | "at">; focus: string | null; nextSeq: number; skipped: string[] } {
  let seq = input.nextSeq;
  const ctx: Ctx = {
    content: input.content,
    sources: input.sources,
    focus: input.focus,
    pending: [...input.pending],
    seq: () => seq++,
    step: input.step ?? null,
    skipped: [...(input.skipped ?? [])],
    live: input.live ?? false,
  };
  const t = text.trim();
  const lower = t.toLowerCase();
  const pendingAll = () => ctx.pending.filter((p) => p.id !== "tmp");
  const interview = opts.interview ?? true;
  const done = (r: Reply) => {
    const final = interview
      ? withNext(ctx, r, [...pendingAll(), ...r.proposals])
      : { ...r, focus: ctx.focus };
    return {
      message: {
        role: "agent" as const,
        text: final.text,
        cites: final.cites,
        proposals: r.proposals,
        suggestions: final.suggestions,
      },
      focus: final.focus,
      nextSeq: seq,
      skipped: ctx.skipped,
    };
  };
  const plain = (text: string, proposals: Proposal[] = [], cites: string[] = []): Reply => ({
    text,
    proposals,
    cites,
    suggestions: [],
    focus: ctx.focus,
  });

  const context = opts.context ?? null;
  if (context) {
    const r = aboutContext(ctx, context, t);
    if (r) return done(r);
  }
  const sourceIds = [...new Set([...(opts.attachments ?? []), ...(t.match(/\bS\d+\b/g) ?? [])])];
  if (
    sourceIds.length ||
    /\b(use|read|from|based on|go through|look at)\b.*\b(doc|document|docs|source|sources|upload|uploads|link|links|file|files|attachment|reference|references|notes?)\b/i.test(
      t,
    )
  ) {
    const ids = sourceIds.length
      ? sourceIds
      : ctx.sources.filter((s) => s.status === "ready").map((s) => s.id);
    return done(fromSources(ctx, ids));
  }
  if (/^(hi|hello|hey|start|help)\b/i.test(t)) {
    return done(
      plain(
        "I'm the BA agent. Tell me about the change in your own words, attach files and links with +, or answer my questions one at a time. I propose every edit and cite where it came from; you decide what goes in.",
      ),
    );
  }
  if (/\bevery requirement\b.*\b(testable|measurable)\b|\bmake (all|them) testable\b/i.test(t)) {
    const replies = ctx.content.requirements
      .filter((r) => r.priority !== "wont")
      .map((r) => makeTestable(ctx, r.id));
    const proposals = replies.flatMap((r) => r.proposals);
    return done(
      plain(
        proposals.length
          ? `I tightened ${proposals.length} requirement${proposals.length > 1 ? "s" : ""}. The numbers are placeholders: set your real targets.`
          : "Every requirement is already measurable.",
        proposals,
      ),
    );
  }
  const brId = (
    t.match(/\bBR-\d+\b/i)?.[0] ?? (context?.rowId?.startsWith("BR-") ? context.rowId : undefined)
  )?.toUpperCase();
  if (brId && /\b(refine|review|critique|check)\b/i.test(t)) return done(refine(ctx, brId));
  if (brId && /\b(testable|measurable|rewrite|tighten|vague|improve|fix)\b/i.test(t))
    return done(makeTestable(ctx, brId));
  if (brId && /\b(remove|delete|drop)\b/i.test(t))
    return done(
      plain(`Removing ${brId}. Anything traced to it in the backlog will be flagged when you regenerate.`, [
        proposal(ctx, {
          op: "remove-row",
          target: "requirements",
          rowId: brId,
          value: null,
          cites: [],
          summary: `Remove ${brId}`,
        }),
      ]),
    );
  if (brId && /\b(must|should|could|won'?t)\b/i.test(t) && /\b(priority|make it|set|change)\b/i.test(t)) {
    const pr = (t.match(/\b(must|should|could|won'?t)\b/i)?.[1] ?? "should")
      .toLowerCase()
      .replace("'", "")
      .replace("wont", "wont") as "must" | "should" | "could" | "wont";
    return done(
      plain(`Changing ${brId} to ${pr}.`, [
        proposal(ctx, {
          op: "update-row",
          target: "requirements",
          rowId: brId,
          value: { priority: pr },
          cites: [],
          summary: `${brId} priority → ${pr}`,
        }),
      ]),
    );
  }
  if (/what('?s| is)? (still )?missing|what next|review it|check it|any gaps/i.test(lower)) {
    const checks = checkBrd(ctx.content);
    const list = checks
      .slice(0, 5)
      .map((c) => `• ${c.message}`)
      .join("\n");
    return done(
      plain(
        checks.length
          ? `${checks.length} open check${checks.length > 1 ? "s" : ""}:\n${list}`
          : "No open checks.",
      ),
    );
  }
  const m = t.match(
    /^(?:add\s+)?(out of scope|not in scope|in scope|risk|assumption|constraint|dependency|term|open question|requirement)s?\s*[:\-–]\s*(.+)$/is,
  );
  if (m?.[1] && m[2]) {
    const kind = m[1].toLowerCase();
    const body = m[2];
    const map: Record<string, string> = {
      "out of scope": "outOfScope",
      "not in scope": "outOfScope",
      "in scope": "inScope",
      risk: "risks",
      assumption: "assumptions",
      constraint: "constraints",
      dependency: "dependencies",
      requirement: "requirements",
    };
    if (kind === "term") {
      const [term = body, def = ""] = body.split(/\s*(?:=|means|:)\s*/);
      return done(
        plain(`Adding “${term}” to the glossary.`, [
          proposal(ctx, {
            op: "add-row",
            target: "glossary",
            rowId: null,
            value: { term: clean(term), definition: clean(def) },
            cites: [],
            summary: `Glossary: ${term}`,
          }),
        ]),
      );
    }
    if (kind === "open question") {
      const id = nextId("OQ-", takenIds(ctx, "openQuestions"), 1);
      return done(
        plain(`Logged ${id}; approvers will see it until it's resolved.`, [
          proposal(ctx, {
            op: "add-row",
            target: "openQuestions",
            rowId: null,
            value: { id, question: clean(body), owner: "", status: "open" },
            cites: [],
            summary: `Open question ${id}`,
          }),
        ]),
      );
    }
    const target = map[kind] ?? "inScope";
    return done(plain("Here's the change.", answer(ctx, target, body)));
  }
  const term = t.match(/^([A-Z][\w-]{1,30}(?:\s[\w-]+){0,3})\s+means\s+(.+)$/);
  if (term?.[1] && term[2])
    return done(
      plain(`Adding “${term[1]}” to the glossary.`, [
        proposal(ctx, {
          op: "add-row",
          target: "glossary",
          rowId: null,
          value: { term: term[1], definition: clean(term[2]) },
          cites: [],
          summary: `Glossary: ${term[1]}`,
        }),
      ]),
    );

  // Lists of people with RACI letters are stakeholders, whatever was asked.
  if (/\(\s*[RACI]\s*\)/.test(t) && ctx.focus !== "stakeholders")
    return done(
      plain("Those look like stakeholders, so I've put them there.", answer(ctx, "stakeholders", t)),
    );

  // A first description of the change, on an empty BRD: draft every section it touches.
  const c0 = ctx.content;
  const blankDoc =
    !c0.summary.trim() && !c0.problem.trim() && !c0.requirements.length && !c0.objectives.length;
  if (blankDoc && (sentences(t).length >= 2 || NEED.test(t))) {
    const mark = ctx.pending.length;
    const first = draftFromBrief(ctx, t);
    if (first.length < 2) ctx.pending.length = mark;
    if (first.length >= 2)
      return done(
        plain(
          ctx.live
            ? `I've started the document from that: ${first.length} change${first.length > 1 ? "s" : ""}, written in on the right. Edit anything directly, or undo a change from here.`
            : `I drafted ${first.length} changes from that. Accept what's right; edit anything directly in the document.`,
          first,
        ),
      );
  }
  // An answer to the question the agent asked, or a first brief.
  if (ctx.focus && !(ctx.focus === "draft")) {
    const proposals = answer(ctx, ctx.focus, t);
    const skipping = /^(skip|no |nothing|none|n\/a)/i.test(t);
    if (!proposals.length && skipping) {
      const key = ctx.focus.split(":")[0] ?? ctx.focus;
      if (!canSkip(ctx.focus))
        return done(
          plain(
            "That one is needed before approval, so I can't skip it. A rough answer is fine; you can refine it later.",
          ),
        );
      if (!ctx.skipped.includes(key)) ctx.skipped.push(key);
    }
    if (proposals.length || skipping) {
      return done(
        plain(proposals.length ? "Got it. Here's how I'd write that." : "Skipping that for now.", proposals),
      );
    }
  }
  const draft = draftFromBrief(ctx, t);
  if (draft.length)
    return done(
      plain(
        ctx.live
          ? `I've written ${draft.length} change${draft.length > 1 ? "s" : ""} into the document from that. Edit anything directly, or undo a change from here.`
          : `I drafted ${draft.length} change${draft.length > 1 ? "s" : ""} from that. Accept what's right; edit anything directly in the document.`,
        draft,
      ),
    );
  if (NEED.test(t)) return done(plain("I've written that as a requirement.", [requirementFrom(ctx, t, [])]));
  return done(
    plain(
      "I couldn't place that in a section. Try “add risk: …”, “out of scope: …”, “make BR-03 testable”, “use S2 for requirements”, or answer the question below.",
    ),
  );
}

/* ── Guided steps and structured capture ───────────────────────────────────────────────────── */

type AgentInput = Parameters<typeof respond>[0];
type AgentOutput = ReturnType<typeof respond>;

function makeCtx(input: AgentInput) {
  let seq = input.nextSeq;
  const ctx: Ctx = {
    content: input.content,
    sources: input.sources,
    focus: input.focus,
    pending: [...input.pending],
    seq: () => seq++,
    step: input.step ?? null,
    skipped: [...(input.skipped ?? [])],
    live: input.live ?? false,
  };
  const finish = (r: Reply): AgentOutput => {
    const all = [...ctx.pending.filter((p) => p.id !== "tmp"), ...r.proposals];
    const final = withNext(ctx, r, all);
    return {
      message: {
        role: "agent",
        text: final.text,
        cites: final.cites,
        proposals: r.proposals,
        suggestions: final.suggestions,
      },
      focus: final.focus,
      nextSeq: seq,
      skipped: ctx.skipped,
    };
  };
  return { ctx, finish };
}

/** The agent's opening for a step: what the step is for, where it stands, and the first question. */
export function enterStep(input: AgentInput, stepId: BrdStepId): AgentOutput {
  const { ctx, finish } = makeCtx({ ...input, step: stepId });
  const step = stepOf(stepId);
  const n = BRD_STEPS.indexOf(step) + 1;
  const checks = stepChecks(step.id, ctx.content);
  const passed = checks.filter((x) => x.ok).length;
  const head = `Step ${n} of ${BRD_STEPS.length} · ${step.title}. ${step.goal}`;
  if (step.id === "review") {
    const all = checkBrd(ctx.content);
    const errors = all.filter((x) => x.severity === "error");
    const list = all
      .slice(0, 6)
      .map((x) => `• ${x.severity === "error" ? "Blocking: " : ""}${x.message}`)
      .join("\n");
    return finish({
      text: `${head}\n\n${all.length ? `${errors.length} blocking, ${all.length - errors.length} warnings:\n${list}` : "No open checks. Submit it for sign-off when you're ready."}`,
      proposals: [],
      cites: [],
      suggestions: all.length
        ? ["Make every requirement testable", "What's still missing?"]
        : ["Submit for sign-off"],
      focus: null,
    });
  }
  return finish({
    text: `${head}\n\n${passed} of ${checks.length} exit checks pass. Answer here, use the form below for a structured entry, or edit the document directly.`,
    proposals: [],
    cites: [],
    suggestions: [],
    focus: null,
  });
}

const DEFAULT_NFR_TARGET: Record<string, string> = {
  availability: "99.9% monthly, excluding planned maintenance",
  performance: "p95 under 2 seconds at peak load",
  security: "No high or critical findings in the pre-release security review",
  compliance: "Zero audit findings on this capability",
  usability: "90% of test users finish the task in 3 steps or fewer",
  reporting: "Available by 09:00 IST every business day",
  data: "Retained for 8 years, then deleted within 30 days",
};

const KIND_LABEL: Record<Capture["kind"], string> = {
  text: "Text",
  objective: "Objective",
  success: "Success criterion",
  scope: "Scope",
  stakeholder: "Stakeholder",
  process: "Process step",
  pain: "Pain point",
  requirement: "Requirement",
  rule: "Business rule",
  nfr: "Non-functional requirement",
  data: "Data",
  risk: "Risk",
  note: "Note",
  term: "Glossary term",
  question: "Open question",
};

/**
 * Turns a structured entry from a capture form into a document change (the author wrote it, so it
 * goes straight in), then reviews it and proposes refinements the author can accept or reject.
 */
export function captureItem(
  input: AgentInput,
  cap: Capture,
): AgentOutput & { change: Proposal; label: string } {
  const { ctx, finish } = makeCtx(input);
  const c = ctx.content;
  const make = (op: Proposal["op"], target: string, value: unknown, summary: string): Proposal => ({
    id: `C${ctx.seq()}`,
    op,
    target,
    rowId: null,
    value,
    cites: [],
    summary,
    status: "accepted",
  });
  let change: Proposal;
  let label: string;
  switch (cap.kind) {
    case "text":
      change = make(
        "set-text",
        cap.target,
        clean(cap.text),
        `Wrote the ${cap.target === "summary" ? "executive summary" : cap.target}`,
      );
      label = cap.target === "summary" ? "Executive summary" : titleCase(cap.target);
      break;
    case "objective": {
      const id = nextId("OBJ-", takenIds(ctx, "objectives"), 1);
      change = make(
        "add-row",
        "objectives",
        {
          id,
          statement: titleCase(cap.statement),
          kpi: titleCase(cap.kpi),
          baseline: cap.baseline || "Not measured yet",
          target: cap.target,
        },
        `Added ${id}`,
      );
      label = `${id} · ${cap.kpi}: ${cap.baseline || "?"} → ${cap.target}`;
      break;
    }
    case "success":
      change = make("add-items", "successCriteria", [titleCase(cap.text)], "Added a success criterion");
      label = cap.text;
      break;
    case "scope":
      change = make(
        "add-items",
        cap.inScope ? "inScope" : "outOfScope",
        [titleCase(cap.text)],
        `Added to ${cap.inScope ? "in" : "out of"} scope`,
      );
      label = `${cap.inScope ? "In" : "Out of"} scope: ${cap.text}`;
      break;
    case "stakeholder":
      change = make(
        "add-row",
        "stakeholders",
        { name: cap.name, role: cap.role, raci: cap.raci, interest: cap.interest },
        `Added ${cap.name}`,
      );
      label = `${cap.name} · ${cap.role} (${cap.raci})`;
      break;
    case "process":
      change = make(
        "add-row",
        cap.when === "current" ? "currentState" : "futureState",
        { actor: cap.actor, step: titleCase(cap.step) },
        `Added a ${cap.when} step`,
      );
      label = `${cap.when === "current" ? "Today" : "Future"}: ${cap.actor} · ${cap.step}`;
      break;
    case "pain":
      change = make("add-items", "painPoints", [titleCase(cap.text)], "Added a pain point");
      label = cap.text;
      break;
    case "requirement": {
      const id = nextId("BR-", takenIds(ctx, "requirements"));
      const action = clean(cap.action)
        .replace(/^(be able to|to|can)\s+/i, "")
        .replace(/\.$/, "");
      const actor = titleCase(clean(cap.actor));
      const objective = cap.objective || bestObjective(c, action)?.id || "";
      change = make(
        "add-row",
        "requirements",
        {
          id,
          title: shortTitle(`x must ${action}`),
          statement: `${actor} shall be able to ${action}.`,
          rationale: cap.benefit ? titleCase(clean(cap.benefit).replace(/^so that\s+/i, "")) : "",
          priority: cap.priority,
          area: cap.area || c.requirements.at(-1)?.area || "Core capability",
          actor,
          objective,
          source: "Author, in BRD Studio",
          acceptance: cap.acceptance.map(clean).filter(Boolean),
        },
        `Added ${id}`,
      );
      label = `${id} · ${actor} shall be able to ${action} (${cap.priority})`;
      break;
    }
    case "rule": {
      const id = nextId("RULE-", takenIds(ctx, "rules"));
      change = make(
        "add-row",
        "rules",
        { id, statement: titleCase(clean(cap.statement)), source: "Author, in BRD Studio" },
        `Added ${id}`,
      );
      label = `${id} · ${cap.statement}`;
      break;
    }
    case "nfr": {
      const id = nextId("NFR-", takenIds(ctx, "nfrs"));
      change = make(
        "add-row",
        "nfrs",
        { id, category: cap.category, statement: titleCase(cap.statement), target: cap.target },
        `Added ${id}`,
      );
      label = `${id} · ${cap.category}: ${cap.statement}${cap.target ? ` · ${cap.target}` : ""}`;
      break;
    }
    case "data":
      change = make(
        "add-row",
        "data",
        {
          entity: cap.entity,
          description: cap.description,
          classification: cap.classification,
          retention: cap.retention || "To be confirmed",
        },
        `Added ${cap.entity}`,
      );
      label = `${cap.entity} (${cap.classification})`;
      break;
    case "risk": {
      const id = nextId("R-", takenIds(ctx, "risks"), 1);
      change = make(
        "add-row",
        "risks",
        {
          id,
          description: titleCase(cap.description),
          impact: cap.impact,
          likelihood: cap.likelihood,
          mitigation: cap.mitigation,
          owner: cap.owner,
        },
        `Added ${id}`,
      );
      label = `${id} · ${cap.description} (${cap.impact} impact)`;
      break;
    }
    case "note":
      change = make("add-items", cap.list, [titleCase(cap.text)], `Added to ${cap.list}`);
      label = `${titleCase(cap.list.replace(/s$/, ""))}: ${cap.text}`;
      break;
    case "term":
      change = make(
        "add-row",
        "glossary",
        { term: cap.term, definition: cap.definition },
        `Added ${cap.term}`,
      );
      label = `${cap.term} = ${cap.definition}`;
      break;
    case "question": {
      const id = nextId("OQ-", takenIds(ctx, "openQuestions"), 1);
      change = make(
        "add-row",
        "openQuestions",
        { id, question: cap.question, owner: cap.owner, status: "open" },
        `Logged ${id}`,
      );
      label = `${id} · ${cap.question}`;
      break;
    }
  }
  ctx.content = applyProposal(c, change);
  const rowId = (change.value as { id?: string } | null)?.id;

  // Review what was just added.
  const notes: string[] = [];
  const proposals: Proposal[] = [];
  if (cap.kind === "requirement" && rowId) {
    const r = refine(ctx, rowId);
    proposals.push(...r.proposals);
    if (r.proposals.length || /•/.test(r.text)) notes.push(r.text);
  }
  if (cap.kind === "objective") {
    if (!/\d/.test(cap.target))
      notes.push(`The target “${cap.target}” has no number, so nobody can tell when it's met.`);
    if (!cap.baseline)
      notes.push("There's no baseline; without today's value the improvement can't be shown.");
  }
  if (cap.kind === "nfr" && !/\d/.test(cap.target) && rowId) {
    proposals.push(
      proposal(ctx, {
        op: "update-row",
        target: "nfrs",
        rowId,
        value: { target: DEFAULT_NFR_TARGET[cap.category] },
        cites: [],
        summary: `Measurable target for ${rowId}`,
      }),
    );
    notes.push(
      `${rowId} needs a measurable target; I've proposed a typical one for ${cap.category}. Change the number to yours.`,
    );
  }
  if (
    cap.kind === "data" &&
    cap.classification === "restricted" &&
    !ctx.content.nfrs.some((n) => n.category === "security")
  ) {
    const id = nextId("NFR-", takenIds(ctx, "nfrs"));
    proposals.push(
      proposal(ctx, {
        op: "add-row",
        target: "nfrs",
        rowId: null,
        value: {
          id,
          category: "security",
          statement:
            "Restricted data is encrypted in transit and at rest, and every access is role-based and logged",
          target: "TLS 1.2+ in transit, AES-256 at rest, 100% of access logged",
        },
        cites: [],
        summary: `Add ${id} (security) for restricted data`,
      }),
    );
    notes.push("Restricted data needs a security requirement before approval; I've proposed one.");
  }
  if (cap.kind === "risk" && !cap.mitigation.trim())
    notes.push(`How will we reduce it? A risk without a mitigation is flagged to approvers.`);
  if (cap.kind === "stakeholder" && !ctx.content.stakeholders.some((s) => s.raci === "A"))
    notes.push("Nobody is Accountable (A) yet; approvers need one owner.");
  if (
    cap.kind === "requirement" &&
    rowId &&
    cap.priority === "must" &&
    !cap.acceptance.some((a) => a.trim()) &&
    !proposals.length
  )
    notes.push("Add acceptance criteria before approval.");

  const out = finish({
    text: `${change.summary}.${notes.length ? `\n\n${notes.join("\n\n")}` : " It reads well."}`,
    proposals,
    cites: [],
    suggestions: [],
    focus: null,
  });
  return { ...out, change, label: `${KIND_LABEL[cap.kind]} · ${label}` };
}
