import {
  type BacklogItem,
  type BacklogKind,
  type BacklogTarget,
  type BrdContent,
  type BusinessRequirement,
  type IssuePriority,
  type MoSCoW,
  type NonFunctional,
  SPRINT_CAPACITY,
  type TaskKind,
  type TestScenario,
} from "@throughline/contracts";
import type { StoryHint } from "./types";

const PRIORITY: Record<MoSCoW, IssuePriority> = {
  must: "highest",
  should: "high",
  could: "medium",
  wont: "low",
};
const RANK: Record<IssuePriority, number> = { highest: 0, high: 1, medium: 2, low: 3 };
const RELEASE: Record<MoSCoW, string> = { must: "MVP", should: "Release 2", could: "Release 3", wont: "" };
const RELEASE_ORDER = ["MVP", "Release 2", "Release 3"];
/** Rough hours per story point, used to size sub-tasks. */
const HOURS_PER_POINT = 6;

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const trimDot = (s: string) => s.replace(/\.$/, "");
const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "into",
  "their",
  "they",
  "must",
  "shall",
  "should",
  "able",
  "will",
  "each",
  "every",
  "when",
  "than",
  "within",
  "system",
  "data",
]);
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 3 && !STOP.has(w)),
  );
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((w) => b.has(w)).length;
const NEGATIVE =
  /\b(not|no|fail|fails|failed|error|reject|rejected|invalid|denied|cannot|can't|without|expired|duplicate|refused|blocked|unknown)\b/i;
const MUTATES =
  /\b(cancel|submit|create|send|approve|retry|close|reply|update|delete|assign|route|escalate)\b/i;
const UI = /app|ui|portal|console|web|front|inbox/i;

/** Fallback when the agent has no refinement notes for a requirement (e.g. one added after approval). */
function storiesFromRequirement(r: BusinessRequirement): StoryHint[] {
  return [
    {
      title: r.title,
      asA: lowerFirst(r.actor),
      iWant: lowerFirst(trimDot(r.title)),
      soThat: lowerFirst(trimDot(r.rationale)),
      criteria: r.acceptance.map((a) => [
        `the ${lowerFirst(r.area)} capability is live`,
        `${lowerFirst(r.actor)} uses it`,
        lowerFirst(trimDot(a)),
      ]),
      points: 0,
      components: [],
      labels: ["needs-refinement"],
    },
  ];
}

/**
 * Which NFRs a business story has to meet, when its notes don't say: the ones it names, plus up to
 * three that fit best by wording and by what the story touches.
 */
function nfrsFor(
  nfrs: NonFunctional[],
  ctx: {
    text: string;
    actor: string;
    components: string[];
    labels: string[];
    restricted: boolean;
    must: boolean;
    /** Words too common in this BRD to say anything (e.g. "email" in an email BRD). */
    common: Set<string>;
  },
) {
  const w = new Set([...words(ctx.text)].filter((x) => !ctx.common.has(x)));
  const has = (re: RegExp) => ctx.components.some((c) => re.test(c));
  const scored = nfrs.map((n) => {
    if (ctx.text.includes(n.id)) return { id: n.id, score: 99 };
    let score = overlap(words(`${n.statement} ${n.target}`), w);
    if (n.category === "security") score += ctx.restricted || ctx.labels.includes("security") ? 2 : 0;
    if (n.category === "compliance") score += ctx.labels.includes("compliance") ? 2 : ctx.restricted ? 1 : 0;
    if (n.category === "performance") score += has(/api|service|worker|engine|connector|adapter/i) ? 1 : 0;
    if (n.category === "availability") score += ctx.must && has(/connector|queue|service|adapter/i) ? 1 : 0;
    if (n.category === "usability")
      score += /customer|user|agent|analyst|manager|lead/i.test(ctx.actor) && has(UI) ? 2 : 0;
    if (n.category === "reporting")
      score += /report|dashboard|kpi|metric|accuracy|monitor/i.test(ctx.text) ? 2 : 0;
    if (n.category === "data") score += ctx.restricted ? 2 : 0;
    return { id: n.id, score };
  });
  return scored
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.id)
    .sort();
}

/**
 * Turns an approved BRD into an enterprise delivery backlog:
 * - one epic per capability area (benefit hypothesis, outcomes and KPIs, scope, risks, owner),
 * - one feature per business requirement (business acceptance criteria, release),
 * - user stories with Given/When/Then criteria, test scenarios, NFRs, rules, data and a DoD,
 * - typed, estimated sub-tasks,
 * plus enabler stories for the non-functional requirements, a transition epic for go-live
 * (KPI baselines, training, cut-over, dependencies) and spikes for open questions.
 * Every item traces back to BRD ids. "Won't" requirements are left out on purpose.
 */
export function generateBacklog(
  content: BrdContent,
  hints: Record<string, StoryHint[]>,
  brdId: string,
): BacklogItem[] {
  const items: BacklogItem[] = [];
  const counters = { epic: 0, feature: 0, story: 0, subtask: 0 };
  const prefix = { epic: "E", feature: "F", story: "S", subtask: "T" } as const;
  const next = (t: keyof typeof counters) => `${prefix[t]}${++counters[t]}`;
  const base = (over: Partial<BacklogItem> & Pick<BacklogItem, "id" | "type" | "title">): BacklogItem => ({
    kind: "business",
    parentId: null,
    description: "",
    story: null,
    acceptance: [],
    priority: "medium",
    points: null,
    labels: [],
    components: [],
    iteration: null,
    traces: [],
    dependsOn: [],
    external: null,
    release: null,
    owner: "",
    businessValue: "",
    outcomes: [],
    criteria: [],
    scope: null,
    nfrs: [],
    rules: [],
    data: [],
    risks: [],
    tests: [],
    definitionOfDone: [],
    notes: [],
    taskKind: null,
    hours: null,
    ...over,
  });

  const who = (s: { name: string; role: string }) => `${s.name} · ${s.role.replace(/\s*\(.*\)\s*$/, "")}`;
  const accountable = content.stakeholders.find((s) => s.raci === "A");
  const po = content.stakeholders.find((s) => s.raci === "R" && /product owner/i.test(s.role));
  /** Epics are owned by the accountable business owner, features and transition work by the product owner. */
  const businessOwner = accountable ? who(accountable) : "Business owner";
  const productOwner = po ? who(po) : accountable ? who(accountable) : "Product owner";
  const objective = new Map(content.objectives.map((o) => [o.id, o]));
  const nfrById = new Map(content.nfrs.map((n) => [n.id, n]));
  const ruleIds = content.rules.map((r) => r.id);
  const pendingDeps: { story: BacklogItem; titles: string[] }[] = [];
  const storyByTitle = new Map<string, string>();

  const dataIn = (text: string) => {
    const t = text.toLowerCase();
    return content.data
      .filter((d) => {
        const key = d.entity.toLowerCase();
        const head = [...words(d.entity)][0];
        return t.includes(key) || (head ? t.includes(head) : false);
      })
      .map((d) => ({ entity: d.entity, classification: d.classification }));
  };
  const risksIn = (text: string, ids: string[]) => {
    const w = words(text);
    return content.risks
      .filter(
        (r) =>
          ids.some((id) => `${r.description} ${r.mitigation}`.includes(id)) ||
          overlap(words(`${r.description} ${r.mitigation}`), w) >= 2,
      )
      .map((r) => r.id);
  };

  /** Typed, estimated sub-tasks for a story. */
  const subtasks = (story: BacklogItem, sensitive: boolean) => {
    const total = (story.points ?? 3) * HOURS_PER_POINT;
    const ui = story.components.some((c) => UI.test(c));
    const build = story.components.slice(0, 3);
    const plan: { kind: TaskKind; title: string; share: number }[] = [
      ...(ui && story.kind === "business"
        ? [{ kind: "design" as const, title: "UX design, copy and accessibility review", share: 0.1 }]
        : []),
      ...(build.length
        ? build.map((c) => ({ kind: "build" as const, title: `Build: ${c}`, share: 0.5 / build.length }))
        : [{ kind: "build" as const, title: "Build", share: 0.5 }]),
      ...(story.data.length
        ? [{ kind: "data" as const, title: `Data: schema, retention and classification tags`, share: 0.05 }]
        : []),
      {
        kind: "test",
        title: `Automated tests: ${story.tests.length} scenario${story.tests.length === 1 ? "" : "s"}`,
        share: 0.25,
      },
      ...(sensitive ||
      story.nfrs.some((n) => /security|compliance/.test(nfrById.get(n)?.category ?? "")) ||
      story.kind === "compliance"
        ? [
            {
              kind: "security" as const,
              title: "Security and compliance review (threat model delta)",
              share: 0.07,
            },
          ]
        : []),
      { kind: "docs", title: "Runbook, API docs and release notes", share: 0.05 },
    ];
    for (const t of plan)
      items.push(
        base({
          id: next("subtask"),
          type: "subtask",
          kind: story.kind,
          parentId: story.id,
          title: t.title,
          priority: story.priority,
          traces: story.traces,
          taskKind: t.kind,
          hours: Math.max(1, Math.round(total * t.share)),
          iteration: null,
          release: story.release,
        }),
      );
  };

  const testsFor = (
    criteria: [string, string, string][],
    opts: { iWant: string; edge?: string[]; nfrs: string[]; role?: boolean },
  ): TestScenario[] => [
    ...criteria.map(([g, w, t]) => ({
      kind: (NEGATIVE.test(`${g} ${t}`) ? "negative" : "happy") as TestScenario["kind"],
      scenario: `Given ${g}, when ${w}, then ${t}.`,
    })),
    ...(opts.role === false
      ? []
      : [
          {
            kind: "negative" as const,
            scenario: `Someone without the right role tries to ${trimDot(opts.iWant)}: it is refused and the attempt is logged.`,
          },
        ]),
    ...(MUTATES.test(opts.iWant)
      ? [
          {
            kind: "edge" as const,
            scenario:
              "The same request arrives twice (double click or retry): it is processed once (idempotent).",
          },
        ]
      : []),
    ...(opts.edge ?? []).map((e) => ({ kind: "edge" as const, scenario: e })),
    ...opts.nfrs.map((id) => {
      const n = nfrById.get(id);
      return { kind: "nfr" as const, scenario: `${id} (${n?.category ?? "quality"}): ${n?.target ?? ""}` };
    }),
  ];

  const live = content.requirements.filter((r) => r.priority !== "wont");
  const freq = new Map<string, number>();
  for (const r of content.requirements)
    for (const x of words(`${r.title} ${r.statement}`)) freq.set(x, (freq.get(x) ?? 0) + 1);
  const common = new Set(
    [...freq].filter(([, n]) => n >= Math.max(3, content.requirements.length * 0.25)).map(([x]) => x),
  );
  const areas = [...new Set(live.map((r) => r.area))];

  for (const area of areas) {
    const reqs = live.filter((r) => r.area === area);
    const out = content.requirements.filter((r) => r.area === area && r.priority === "wont");
    const epicPriority =
      reqs.map((r) => PRIORITY[r.priority]).sort((a, b) => RANK[a] - RANK[b])[0] ?? "medium";
    const objs = [...new Set(reqs.map((r) => r.objective))]
      .map((id) => objective.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    const epic = base({
      id: next("epic"),
      type: "epic",
      title: area,
      description: `Delivers ${reqs.map((r) => r.id).join(", ")} from ${brdId}.\n\n${short(content.problem, 320)}`,
      priority: epicPriority,
      labels: [slug(brdId), slug(area)],
      traces: [...reqs.map((r) => r.id), ...objs.map((o) => o.id)],
      owner: businessOwner,
      release:
        RELEASE_ORDER.find((x) => reqs.some((r) => RELEASE[r.priority] === x)) ?? RELEASE_ORDER[0] ?? "MVP",
      businessValue: objs.length
        ? `${area} ${objs.map((o) => lowerFirst(trimDot(o.statement))).join("; ")}.`
        : `${area} for ${[...new Set(reqs.map((r) => lowerFirst(r.actor)))].join(", ")}.`,
      outcomes: objs.map((o) => ({ objective: o.id, kpi: o.kpi, baseline: o.baseline, target: o.target })),
      criteria: [
        `Every Must story in ${area} is accepted by the product owner in UAT`,
        ...objs.map((o) => `${o.kpi} is tracked on the production dashboard (target ${o.target})`),
        "No open critical or high defects; runbook handed over to operations",
      ],
      scope: {
        in: reqs.map((r) => `${r.id} ${r.title}`),
        out: [...out.map((r) => `${r.id} ${r.title}`), ...content.outOfScope],
      },
      risks: risksIn(
        `${area} ${reqs.map((r) => `${r.title} ${r.statement}`).join(" ")}`,
        reqs.map((r) => r.id),
      ),
      data: dataIn(reqs.map((r) => `${r.title} ${r.statement}`).join(" ")),
    });
    items.push(epic);

    for (const r of reqs) {
      const o = objective.get(r.objective);
      const text = `${r.title} ${r.statement} ${r.acceptance.join(" ")}`;
      const data = dataIn(text);
      const feature = base({
        id: next("feature"),
        type: "feature",
        parentId: epic.id,
        title: r.title,
        description: `${r.statement}\n\nWhy: ${r.rationale}\nSource: ${r.source || "not recorded"}`,
        priority: PRIORITY[r.priority],
        labels: [r.priority, slug(area)],
        traces: [r.id, ...(o ? [o.id] : [])],
        owner: productOwner,
        release: RELEASE[r.priority],
        businessValue: o
          ? `We believe that ${lowerFirst(trimDot(r.statement))} will ${lowerFirst(trimDot(o.statement))}. We'll know it worked when ${o.kpi} moves from ${o.baseline} to ${o.target}.`
          : `${trimDot(r.rationale)}.`,
        criteria: r.acceptance,
        data,
        risks: risksIn(text, [r.id]),
      });
      items.push(feature);

      for (const h of hints[r.id] ?? storiesFromRequirement(r)) {
        const crit = h.criteria.flat().join(" ");
        const rules = ruleIds.filter((id) => crit.includes(id) || r.acceptance.join(" ").includes(id));
        const sdata = dataIn(`${h.title} ${h.iWant} ${crit}`);
        const storyData = sdata.length ? sdata : data;
        const sensitive = storyData.some(
          (d) => d.classification === "restricted" || d.classification === "confidential",
        );
        const labels = [slug(area), ...(h.labels ?? [])];
        const nfrs =
          h.nfrs ??
          nfrsFor(content.nfrs, {
            text: `${crit} ${r.statement}`,
            actor: h.asA,
            components: h.components,
            labels,
            restricted: storyData.some((d) => d.classification === "restricted"),
            common,
            must: r.priority === "must",
          });
        const story = base({
          id: next("story"),
          type: "story",
          kind: labels.includes("compliance") ? "compliance" : "business",
          parentId: feature.id,
          title: h.title,
          description: `As a ${h.asA}, I want ${h.iWant}, so that ${h.soThat}.`,
          story: { asA: h.asA, iWant: h.iWant, soThat: h.soThat },
          acceptance: h.criteria.map(([given, when, then]) => ({ given, when, then })),
          priority: PRIORITY[r.priority],
          points: h.points > 0 ? h.points : null,
          labels,
          components: h.components,
          traces: [r.id, ...rules],
          rules,
          nfrs,
          data: storyData,
          risks: feature.risks,
          release: RELEASE[r.priority],
          owner: h.components[0] ? `${h.components[0]} team` : "Delivery team",
          tests: testsFor(h.criteria, { iWant: h.iWant, edge: h.edge, nfrs }),
          definitionOfDone: [
            ...rules.map((id) => {
              const rule = content.rules.find((x) => x.id === id);
              return `Enforces ${id}: ${short(rule?.statement ?? "", 80)}`;
            }),
            ...nfrs.map((id) => `Verified ${id}: ${nfrById.get(id)?.target ?? ""}`),
            ...(sensitive
              ? [
                  `${storyData.map((d) => d.entity).join(", ")} handled per classification (masked in logs, encrypted at rest)`,
                ]
              : []),
          ],
          notes: h.notes ?? [],
        });
        items.push(story);
        storyByTitle.set(h.title.toLowerCase(), story.id);
        if (h.dependsOn?.length) pendingDeps.push({ story, titles: h.dependsOn });
        subtasks(story, sensitive);
      }
    }
  }

  // Non-functional enablers.
  if (content.nfrs.length > 0) {
    const epic = base({
      id: next("epic"),
      type: "epic",
      kind: "enabler",
      title: "Non-functional and compliance",
      description: `Enabler work so the service meets ${content.nfrs.map((n) => n.id).join(", ")}.`,
      priority: "high",
      labels: [slug(brdId), "nfr"],
      traces: content.nfrs.map((n) => n.id),
      owner: "Platform team",
      release: "MVP",
      businessValue:
        "Keeps the service available, secure, compliant and measurable from day one, so the business outcomes hold up in production.",
      criteria: [
        "Every NFR has an automated check in the release pipeline",
        "Dashboards and alerts exist for each availability and performance target",
        "Security and compliance sign-off recorded before go-live",
      ],
      scope: { in: content.nfrs.map((n) => `${n.id} ${n.statement}`), out: [] },
      risks: risksIn(
        content.nfrs.map((n) => n.statement).join(" "),
        content.nfrs.map((n) => n.id),
      ),
    });
    items.push(epic);
    for (const n of content.nfrs) {
      const compliance = n.category === "security" || n.category === "compliance";
      const story = base({
        id: next("story"),
        type: "story",
        kind: compliance ? "compliance" : "enabler",
        parentId: epic.id,
        title: `${n.id}: ${short(n.statement, 80)}`,
        description: `As the platform team, I want ${lowerFirst(trimDot(n.statement))} (${n.target}), so that the service meets its quality requirements.`,
        story: {
          asA: "platform team",
          iWant: `${lowerFirst(trimDot(n.statement))} (${n.target})`,
          soThat: "the service meets its quality requirements",
        },
        acceptance: [
          {
            given: "a production-like environment and data",
            when: `the ${n.category} check for ${n.id} runs in the release pipeline`,
            // biome-ignore lint/suspicious/noThenProperty: Given/When/Then criterion, never awaited
            then: `it passes: ${n.target}`,
          },
          {
            given: `the ${n.category} target is breached in production`,
            when: "monitoring evaluates it",
            // biome-ignore lint/suspicious/noThenProperty: Given/When/Then criterion, never awaited
            then: "an alert reaches the on-call engineer within 5 minutes",
          },
        ],
        priority: "high",
        points: 5,
        labels: ["nfr", n.category],
        components: ["platform"],
        traces: [n.id],
        nfrs: [n.id],
        release: "MVP",
        owner: "Platform team",
        tests: [
          {
            kind: "nfr",
            scenario: `${n.id}: ${n.target}, measured in the pipeline on production-like data.`,
          },
          {
            kind: "negative",
            scenario: "Target deliberately breached in test: the pipeline fails and the alert fires.",
          },
        ],
        definitionOfDone: [
          `Check for ${n.id} runs on every release`,
          "Dashboard and alert documented in the runbook",
        ],
      });
      items.push(story);
      for (const [kind, title, share] of [
        ["devops", "Automate the check in CI/CD", 0.4],
        ["devops", "Dashboard and alert", 0.3],
        ["test", "Prove the check fails when the target is breached", 0.2],
        ["docs", "Runbook entry", 0.1],
      ] as const)
        items.push(
          base({
            id: next("subtask"),
            type: "subtask",
            kind: story.kind,
            parentId: story.id,
            title,
            priority: "high",
            traces: [n.id],
            taskKind: kind,
            hours: Math.max(1, Math.round(5 * HOURS_PER_POINT * share)),
            release: "MVP",
          }),
        );
    }
  }

  // Transition and go-live: KPI baselines, people and process change, cut-over, dependencies.
  const transition: {
    title: string;
    asA: string;
    iWant: string;
    soThat: string;
    criteria: [string, string, string][];
    points: number;
    traces: string[];
    notes?: string[];
    tasks: [TaskKind, string][];
    first?: boolean;
  }[] = [];
  if (content.objectives.length)
    transition.push({
      title: "Measure KPI baselines before launch",
      asA: "product owner",
      iWant: "the current value of every objective's KPI measured from production data",
      soThat: "we can prove the change worked",
      criteria: content.objectives.map((o) => [
        "4 weeks of production data before launch",
        `the baseline report for ${o.id} runs`,
        `${o.kpi} is recorded (BRD baseline: ${o.baseline})`,
      ]),
      points: 3,
      traces: content.objectives.map((o) => o.id),
      tasks: [
        ["data", "Baseline queries for each KPI"],
        ["build", "KPI dashboard (before / after)"],
      ],
      first: true,
    });
  const objIds = content.objectives.map((o) => o.id);
  const actors = [...new Set(content.currentState.map((s) => s.actor))].filter(
    (a) => !/system|listener|psp|bank|api|service|customer|client|merchant/i.test(a),
  );
  if (actors.length)
    transition.push({
      title: `Update procedures and train ${actors.slice(0, 3).join(", ")}`,
      asA: "operations lead",
      iWant: "updated procedures and hands-on training before go-live",
      soThat: "the new process is followed from the first day",
      criteria: actors.map((a) => [
        `the new process is in UAT`,
        `${a} completes the training`,
        "they can run the to-be process without help",
      ]),
      points: 3,
      traces: objIds,
      tasks: [
        ["change", "Rewrite SOPs for the to-be process"],
        ["change", "Training sessions and quick-reference guide"],
      ],
    });
  transition.push({
    title: "Cut-over, rollback and hypercare plan",
    asA: "release manager",
    iWant: "a rehearsed cut-over with a rollback path and two weeks of hypercare",
    soThat: "go-live is safe and reversible",
    criteria: [
      [
        "the release is ready",
        "the cut-over is rehearsed in staging",
        "it completes inside the change window",
      ],
      [
        "a critical defect after go-live",
        "the rollback runs",
        "the previous process is restored within 30 minutes",
      ],
    ],
    points: 3,
    traces: objIds,
    tasks: [
      ["devops", "Feature flags and rollback script"],
      ["change", "Hypercare rota and daily check-in"],
    ],
  });
  if (content.dependencies.length)
    transition.push({
      title: "Confirm integration readiness of every dependency",
      asA: "delivery lead",
      iWant: "each external dependency confirmed with an owner and a date",
      soThat: "nothing outside the team blocks the release",
      criteria: content.dependencies
        .slice(0, 5)
        .map((d) => [
          "the release plan",
          `the dependency “${short(d, 60)}” is reviewed`,
          "it has an owner, a confirmed date and a test environment",
        ]),
      points: 3,
      traces: objIds,
      notes: content.dependencies,
      tasks: content.dependencies
        .slice(0, 4)
        .map((d) => ["change", `Confirm: ${short(d, 60)}`] as [TaskKind, string]),
    });
  const informed = content.stakeholders.filter((s) => s.raci === "I").map((s) => s.name);
  if (informed.length)
    transition.push({
      title: "Communicate the change",
      asA: "product owner",
      iWant: `release communications for ${informed.slice(0, 3).join(", ")}`,
      soThat: "everyone affected knows what changes and when",
      criteria: [
        [
          "the go-live date is set",
          "communications go out",
          "every informed stakeholder has them 5 working days before",
        ],
      ],
      points: 2,
      traces: objIds,
      tasks: [["change", "Release notes and stakeholder email"]],
    });
  const firstStories = new Set<string>();
  if (transition.length) {
    const epic = base({
      id: next("epic"),
      type: "epic",
      kind: "transition",
      title: "Transition and go-live",
      description:
        "Everything that makes the release land: KPI baselines, people and process change, cut-over and dependencies.",
      priority: "high",
      labels: [slug(brdId), "transition"],
      traces: content.objectives.map((o) => o.id),
      owner: productOwner,
      release: "MVP",
      businessValue: "Makes sure the benefits are measured and the organisation is ready on day one.",
      criteria: [
        "KPI baselines recorded before launch",
        "Users trained and SOPs updated",
        "Cut-over rehearsed; hypercare staffed",
      ],
      scope: { in: transition.map((t) => t.title), out: [] },
    });
    items.push(epic);
    for (const t of transition) {
      const story = base({
        id: next("story"),
        type: "story",
        kind: "transition",
        parentId: epic.id,
        title: t.title,
        description: `As a ${t.asA}, I want ${t.iWant}, so that ${t.soThat}.`,
        story: { asA: t.asA, iWant: t.iWant, soThat: t.soThat },
        acceptance: t.criteria.map(([given, when, then]) => ({ given, when, then })),
        priority: "high",
        points: t.points,
        labels: ["transition"],
        components: [],
        traces: t.traces,
        release: "MVP",
        owner: productOwner,
        notes: t.notes ?? [],
        tests: testsFor(t.criteria, { iWant: t.iWant, nfrs: [], role: false }),
      });
      items.push(story);
      if (t.first) firstStories.add(story.id);
      const per = Math.max(1, Math.round((t.points * HOURS_PER_POINT) / t.tasks.length));
      for (const [kind, title] of t.tasks)
        items.push(
          base({
            id: next("subtask"),
            type: "subtask",
            kind: "transition",
            parentId: story.id,
            title,
            priority: "high",
            traces: t.traces,
            taskKind: kind,
            hours: per,
            release: "MVP",
          }),
        );
    }
  }

  // Spikes for open questions.
  const open = content.openQuestions.filter((q) => q.status === "open");
  if (open.length) {
    const epic = base({
      id: next("epic"),
      type: "epic",
      kind: "spike",
      title: "Open questions (spikes)",
      description:
        "Time-boxed investigations that close the BRD's open questions before the stories that depend on them start.",
      priority: "high",
      labels: [slug(brdId), "spike"],
      traces: open.map((q) => q.id),
      owner: productOwner,
      release: "MVP",
      criteria: ["Each question has a recorded decision in the BRD", "Affected stories updated"],
    });
    items.push(epic);
    for (const q of open) {
      const story = base({
        id: next("story"),
        type: "story",
        kind: "spike",
        parentId: epic.id,
        title: `Spike: ${q.id} ${short(q.question, 70)}`,
        description: `Time-boxed to 2 days. ${q.question}`,
        story: {
          asA: q.owner || "product owner",
          iWant: `a decision on ${q.id}: ${lowerFirst(trimDot(q.question))}`,
          soThat: "the dependent stories can be built without rework",
        },
        acceptance: [
          {
            given: "the options and their trade-offs",
            when: `${q.owner || "the owner"} reviews them`,
            // biome-ignore lint/suspicious/noThenProperty: Given/When/Then criterion, never awaited
            then: `a decision is recorded against ${q.id} in the BRD and affected stories are updated`,
          },
        ],
        priority: "high",
        points: 2,
        labels: ["spike"],
        traces: [q.id],
        release: "MVP",
        owner: q.owner || productOwner,
        tests: [
          { kind: "happy", scenario: `Decision for ${q.id} recorded and linked from the affected stories.` },
        ],
      });
      items.push(story);
      firstStories.add(story.id);
      items.push(
        base({
          id: next("subtask"),
          type: "subtask",
          kind: "spike",
          parentId: story.id,
          title: "Options paper and decision meeting",
          priority: "high",
          traces: [q.id],
          taskKind: "docs",
          hours: 8,
          release: "MVP",
        }),
      );
    }
  }

  for (const { story, titles } of pendingDeps)
    story.dependsOn = titles
      .map((t) => storyByTitle.get(t.toLowerCase()))
      .filter((x): x is string => Boolean(x));

  planSprints(items, firstStories);
  return items;
}

const KIND_ORDER: Record<BacklogKind, number> = {
  spike: 0,
  enabler: 1,
  compliance: 2,
  business: 2,
  transition: 3,
};

/**
 * Suggests sprints: release first, then spikes and baselines, enablers, business work, transition;
 * highest priority first; never before a story's dependencies; ~30 points a sprint.
 */
function planSprints(items: BacklogItem[], first: Set<string>) {
  const stories = items.filter((i) => i.type === "story");
  const pos = new Map(stories.map((s, i) => [s.id, i]));
  const rel = (s: BacklogItem) => {
    const i = RELEASE_ORDER.indexOf(s.release ?? "");
    return i < 0 ? RELEASE_ORDER.length : i;
  };
  const key = (s: BacklogItem) => [
    rel(s),
    first.has(s.id) ? -1 : KIND_ORDER[s.kind],
    RANK[s.priority],
    pos.get(s.id) ?? 0,
  ];
  const order = [...stories].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return (ka[i] ?? 0) - (kb[i] ?? 0);
    return 0;
  });
  // Dependencies first.
  const placed = new Set<string>();
  const sequence: BacklogItem[] = [];
  const byId = new Map(stories.map((s) => [s.id, s]));
  const visit = (s: BacklogItem, seen: Set<string>) => {
    if (placed.has(s.id) || seen.has(s.id)) return;
    seen.add(s.id);
    for (const d of s.dependsOn) {
      const dep = byId.get(d);
      if (dep) visit(dep, seen);
    }
    placed.add(s.id);
    sequence.push(s);
  };
  for (const s of order) visit(s, new Set());

  let sprint = 1;
  let load = 0;
  let release: string | null = sequence[0]?.release ?? null;
  for (const s of sequence) {
    const p = s.points ?? 3;
    // A new release starts a new sprint; otherwise fill to capacity.
    if ((load + p > SPRINT_CAPACITY || s.release !== release) && load > 0) {
      sprint++;
      load = 0;
    }
    load += p;
    release = s.release;
    s.iteration = `Sprint ${sprint}`;
  }
  for (const t of items)
    if (t.type === "subtask") t.iteration = byId.get(t.parentId ?? "")?.iteration ?? null;
}

/** What the tool would hand back when items are created there. */
export function externalKey(target: BacklogTarget, project: string, seq: number) {
  if (target === "jira") return { key: `${project}-${100 + seq}`, url: `jira:${project}-${100 + seq}` };
  const id = 4500 + seq;
  return { key: `AB#${id}`, url: `azure-boards:${project}/${id}` };
}
