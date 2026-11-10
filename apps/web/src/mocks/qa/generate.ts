import type {
  Architecture,
  Backlog,
  BacklogItem,
  Brd,
  ExitCriterion,
  Project,
  ProjectPlan,
  TestApproach,
  TestCase,
  TestCoverage,
  TestLevel,
  TestPlan,
  TestPriority,
  TestRun,
  TestTool,
  TestTrace,
} from "@throughline/contracts";
import { CLOUD_LABEL, REGIONS } from "../architect/catalog";
import { securityControls } from "../architect/controls";

/**
 * The QA agent stand-in. Turns what a project already knows (the approved BRD, its backlog, the
 * architecture and the project plan) into a test plan structured after ISO/IEC/IEEE 29119-3.
 * Every case says what it proves: the requirement, NFR, rule, story, control or component it
 * traces to. Deterministic, so a regenerated plan only changes when its inputs change.
 */

export type TestInput = {
  project: Project;
  brd: Brd | null;
  backlog: Backlog | null;
  architecture: Architecture | null;
  plan: ProjectPlan | null;
  /** Cases for work that has no BRD yet (authored by the QA lead). */
  authored?: AuthoredCase[];
  target: TestTool;
  owner: string;
  at: string;
};

export type AuthoredCase = {
  title: string;
  level: TestLevel;
  priority: TestPriority;
  workItem: string;
  steps: [string, string][];
  tool?: string;
  automated?: boolean;
};

const TOOL: Record<TestLevel, string> = {
  unit: "Vitest / pytest",
  contract: "Pact",
  integration: "Testcontainers",
  system: "API tests (Playwright request)",
  e2e: "Playwright",
  uat: "Manual (UAT script)",
  performance: "k6",
  security: "OWASP ZAP + manual pen test",
  resilience: "Azure Chaos Studio / failover drill",
  accessibility: "axe-core + screen reader",
  "ai-eval": "Eval harness (golden set)",
  data: "SQL checks + policy scan",
};

const AUTOMATED: Record<TestLevel, boolean> = {
  unit: true,
  contract: true,
  integration: true,
  system: true,
  e2e: true,
  uat: false,
  performance: true,
  security: true,
  resilience: false,
  accessibility: true,
  "ai-eval": true,
  data: true,
};

const priorityOf = (p: BacklogItem["priority"]): TestPriority =>
  p === "highest" || p === "high" ? "P1" : p === "medium" ? "P2" : "P3";

/** NFR-flavoured scenario text → the level that can prove it. */
function levelForText(text: string, fallback: TestLevel): TestLevel {
  const t = text.toLowerCase();
  if (/secur|token|auth|encrypt|redact|mask|pii|phishing|injection|tamper/.test(t)) return "security";
  if (/latency|p95|p99|load|throughput|per second|within \d+ ?(ms|s|sec|seconds|minutes)/.test(t))
    return "performance";
  if (/availab|failover|outage|recover|retry|dead-letter|rto|rpo/.test(t)) return "resilience";
  if (/accessib|wcag|screen reader/.test(t)) return "accessibility";
  if (/retention|residen|audit|purge|archiv/.test(t)) return "data";
  return fallback;
}

/** Text that suggests the system uses a model or an agent. */
const AI_HINT = /\b(ai|agent|model|llm|classif|draft|openai|prompt|eval)\b/i;

function addDays(d: string, n: number): string {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function generateTestPlan(input: TestInput): TestPlan {
  const { project, brd, backlog, architecture, plan } = input;
  const c = brd?.content;
  const cases: TestCase[] = [];
  let n = 0;
  const label = new Map<string, string>();
  for (const r of c?.requirements ?? []) label.set(r.id, r.title);
  for (const x of c?.nfrs ?? []) label.set(x.id, `${x.statement} (${x.target})`);
  for (const x of c?.rules ?? []) label.set(x.id, x.statement);
  for (const x of c?.objectives ?? []) label.set(x.id, x.statement);
  const traceOf = (id: string): TestTrace => ({
    kind: id.startsWith("BR-")
      ? "requirement"
      : id.startsWith("NFR-")
        ? "nfr"
        : id.startsWith("RULE-")
          ? "rule"
          : id.startsWith("OBJ-")
            ? "objective"
            : id.startsWith("BR")
              ? "requirement"
              : "risk",
    id,
    label: label.get(id) ?? id,
  });
  const mustIds = new Set((c?.requirements ?? []).filter((r) => r.priority === "must").map((r) => r.id));
  const add = (
    x: Omit<
      TestCase,
      "id" | "status" | "result" | "lastRunAt" | "defects" | "external" | "tool" | "automated"
    > & {
      tool?: string;
      automated?: boolean;
    },
  ) => {
    n += 1;
    cases.push({
      id: `${project.key}-TC-${String(n).padStart(3, "0")}`,
      status: "ready",
      result: "not-run",
      lastRunAt: null,
      defects: [],
      external: null,
      ...x,
      tool: x.tool ?? TOOL[x.level],
      automated: x.automated ?? AUTOMATED[x.level],
    });
  };

  /* 1. Stories: every test scenario in the backlog becomes a case. */
  const stories = (backlog?.items ?? []).filter((i) => i.type === "story");
  for (const s of stories) {
    const traces: TestTrace[] = [
      { kind: "story", id: s.id, label: s.title },
      ...s.traces.map(traceOf),
      ...s.nfrs.filter((x) => !s.traces.includes(x)).map(traceOf),
      ...s.rules.filter((x) => !s.traces.includes(x)).map(traceOf),
    ];
    const critical = s.traces.some((t) => mustIds.has(t));
    for (const t of s.tests) {
      const level: TestLevel =
        t.kind === "happy"
          ? critical
            ? "e2e"
            : "system"
          : t.kind === "edge"
            ? "integration"
            : t.kind === "nfr"
              ? levelForText(t.scenario, "system")
              : levelForText(t.scenario, "system");
      const steps =
        t.kind === "happy" && s.acceptance.length
          ? s.acceptance.map((a) => ({ action: `Given ${a.given}, when ${a.when}`, expected: a.then }))
          : [
              { action: t.scenario, expected: EXPECTED[t.kind] },
              {
                action: "Check the audit trail and monitoring for the action",
                expected: "One audit event with actor, time and outcome; no error alerts",
              },
            ];
      add({
        title: `${s.title}: ${t.scenario}`.slice(0, 160),
        level,
        priority:
          t.kind === "happy" || t.kind === "negative"
            ? priorityOf(s.priority)
            : priorityOf(s.priority) === "P1"
              ? "P2"
              : "P3",
        risk: critical ? "high" : "medium",
        objective: `Proves ${s.traces.join(", ") || s.id} (${t.kind} path).`,
        preconditions: [
          "Test environment deployed from the release candidate",
          ...(s.data.length ? [`Masked test data for ${s.data.map((d) => d.entity).join(", ")}`] : []),
        ],
        steps,
        data: s.data.length ? s.data.map((d) => `${d.entity} (${d.classification})`).join("; ") : "Synthetic",
        traces,
      });
    }
  }

  /* 2. Without a backlog, the BRD's acceptance criteria become system and UAT cases. */
  if (!stories.length)
    for (const r of (c?.requirements ?? []).filter((x) => x.priority !== "wont")) {
      r.acceptance.forEach((ac, i) => {
        add({
          title: `${r.title}: acceptance ${i + 1}`,
          level: r.priority === "must" ? "e2e" : "system",
          priority: r.priority === "must" ? "P1" : r.priority === "should" ? "P2" : "P3",
          risk: r.priority === "must" ? "high" : "medium",
          objective: `Proves ${r.id}: ${r.statement}`,
          preconditions: ["Test environment deployed from the release candidate"],
          steps: [{ action: ac, expected: "Outcome matches the acceptance criterion exactly" }],
          data: "Synthetic",
          traces: [
            traceOf(r.id),
            { kind: "objective", id: r.objective, label: label.get(r.objective) ?? r.objective },
          ],
        });
      });
    }

  /* 3. Business rules: each one gets a negative test. */
  for (const r of c?.rules ?? [])
    add({
      title: `Rule enforced: ${r.statement}`.slice(0, 160),
      level: "system",
      priority: "P2",
      risk: "medium",
      objective: `Proves ${r.id} cannot be bypassed.`,
      preconditions: ["Test environment deployed from the release candidate"],
      steps: [
        {
          action: `Attempt an action that breaks the rule: ${r.statement}`,
          expected: "The system refuses it with a clear reason",
        },
        {
          action: "Repeat through the API directly, bypassing the UI",
          expected: "Refused the same way; attempt logged",
        },
      ],
      data: "Synthetic",
      traces: [traceOf(r.id)],
    });

  /* 4. Non-functional requirements: measured against their targets. */
  for (const x of c?.nfrs ?? []) {
    const level: TestLevel =
      x.category === "performance"
        ? "performance"
        : x.category === "availability"
          ? "resilience"
          : x.category === "security"
            ? "security"
            : x.category === "usability"
              ? "accessibility"
              : x.category === "reporting"
                ? "system"
                : "data";
    add({
      title: `${x.id}: ${x.statement}`.slice(0, 160),
      level,
      priority: level === "accessibility" || level === "system" ? "P2" : "P1",
      risk: "high",
      objective: `Verifies the target: ${x.target}.`,
      preconditions: [
        level === "performance"
          ? "Performance environment at production scale"
          : "Pre-production environment",
      ],
      steps: [
        { action: STEP_FOR[level] ?? `Measure: ${x.statement}`, expected: `Target met: ${x.target}` },
        {
          action: "Record the measurement as evidence on the release",
          expected: "Evidence attached to the G3 change",
        },
      ],
      data:
        level === "performance"
          ? "Generated load at 2× expected peak"
          : "Masked copy of production-shaped data",
      traces: [traceOf(x.id)],
    });
  }

  /* 5. Security controls from the architecture. */
  if (architecture) {
    for (const ctl of securityControls(architecture.brief))
      add({
        title: `${ctl.id} ${ctl.name}`,
        level: "security",
        priority: ["C1", "C3", "C5", "C6", "C7", "C14"].includes(ctl.id) ? "P1" : "P2",
        risk: "high",
        objective: `Proves the control holds: ${ctl.detail}`,
        preconditions: ["Pre-production deployed with production network policy"],
        steps: [
          {
            action: CONTROL_TEST[ctl.id] ?? `Try to get around: ${ctl.name}`,
            expected: "Blocked, and the attempt is logged and alerted",
          },
        ],
        data: "None (infrastructure test)",
        tool: CONTROL_TOOL[ctl.id] ?? TOOL.security,
        traces: [{ kind: "control", id: ctl.id, label: ctl.name }],
      });

    /* 6. Components: contracts with external systems, recovery of stores, failover. */
    for (const comp of architecture.components) {
      if (comp.status === "external" && comp.category === "external")
        add({
          title: `Contract with ${comp.name}`,
          level: "contract",
          priority: "P1",
          risk: "high",
          objective: `The integration with ${comp.name} keeps working when either side changes.`,
          preconditions: ["Provider stub or sandbox available"],
          steps: [
            {
              action: `Run consumer contract tests against ${comp.name} (${comp.config.find((k) => k.k === "Protocol")?.v ?? "API"})`,
              expected: "All interactions verified; breaking changes fail the build",
            },
            {
              action: `Simulate ${comp.name} being slow or down`,
              expected: "Retries with backoff, then a clear failure path; no data lost",
            },
          ],
          data: "Synthetic",
          traces: [{ kind: "component", id: comp.id, label: comp.name }],
        });
      if (comp.id === "db")
        add({
          title: "Database backup and point-in-time restore",
          level: "resilience",
          priority: "P1",
          risk: "high",
          objective: "Data can be recovered within the recovery point objective.",
          preconditions: ["Pre-production database with representative volume"],
          steps: [
            {
              action: "Restore to a point 10 minutes ago into a new server",
              expected: "Restore completes; row counts and checksums match",
            },
          ],
          data: "Masked copy",
          traces: [{ kind: "component", id: comp.id, label: `${comp.name} · ${comp.product}` }],
        });
      if (comp.id === "bus")
        add({
          title: "Poison message goes to dead-letter and can be replayed",
          level: "resilience",
          priority: "P2",
          risk: "medium",
          objective: "Failures never lose work and can be recovered.",
          preconditions: ["Consumer running"],
          steps: [
            {
              action: "Publish a message the consumer can't process",
              expected: "Retried 5 times, then dead-lettered; alert raised",
            },
            { action: "Fix and replay from the dead-letter queue", expected: "Processed exactly once" },
          ],
          data: "Synthetic",
          traces: [{ kind: "component", id: comp.id, label: `${comp.name} · ${comp.product}` }],
        });
      if (comp.id === "dr")
        add({
          title: "Regional failover drill",
          level: "resilience",
          priority: "P1",
          risk: "high",
          objective: "The standby region takes over within the recovery time objective.",
          preconditions: ["Change window agreed; stakeholders on the bridge"],
          steps: [
            {
              action: "Fail the primary region (planned drill)",
              expected: "Traffic moves to the standby; database promoted",
            },
            {
              action: "Run the smoke suite against the standby",
              expected: "All smoke tests pass; RTO and RPO recorded",
            },
          ],
          data: "Production-like",
          traces: [{ kind: "component", id: comp.id, label: comp.name }],
        });
    }
  }

  /* 7. AI-specific evaluation when the solution uses a model or governs agents. */
  const usesAi =
    (architecture && architecture.brief.ai !== "none") ||
    (architecture?.components ?? []).some((x) =>
      ["content-safety", "language", "agent-identity", "llm"].includes(x.role),
    ) ||
    (c ? AI_HINT.test(`${c.summary} ${c.requirements.map((r) => r.title).join(" ")}`) : false);
  if (usesAi) {
    const aiNfr = (c?.nfrs ?? []).find((x) =>
      /accura|precision|recall|confidence/i.test(`${x.statement} ${x.target}`),
    );
    const aiReqs = (c?.requirements ?? [])
      .filter((r) =>
        /classif|draft|resolv|screen|inject|identity|agent|model/i.test(`${r.title} ${r.statement}`),
      )
      .map((r) => r.id);
    for (const e of AI_EVALS)
      add({
        title: e.title,
        level: "ai-eval",
        priority: e.priority,
        risk: "high",
        objective: e.objective,
        preconditions: [
          "Versioned evaluation set approved by the business owner",
          "Model and prompt versions pinned",
        ],
        steps: e.steps.map(([action, expected]) => ({
          action,
          expected: expected.replace("{target}", aiNfr?.target ?? "the agreed threshold"),
        })),
        data: "Labelled, masked evaluation set",
        tool: e.tool,
        traces: [...aiReqs.slice(0, 3).map(traceOf), ...(aiNfr ? [traceOf(aiNfr.id)] : [])],
      });
  }

  /* 8. UAT: the business confirms each objective can be measured and is moving. */
  for (const o of c?.objectives ?? [])
    add({
      title: `UAT: ${o.statement}`,
      level: "uat",
      priority: "P1",
      risk: "high",
      objective: `Business confirms ${o.kpi} can be measured from ${o.baseline} towards ${o.target}.`,
      preconditions: ["UAT environment with trained business users", "KPI dashboard connected"],
      steps: [
        {
          action: "Run the business scenario end to end with real users",
          expected: "Users complete it without help",
        },
        {
          action: `Check the KPI: ${o.kpi}`,
          expected: `Measured and reported; baseline ${o.baseline}, target ${o.target}`,
        },
      ],
      data: "Masked production-shaped data",
      traces: [traceOf(o.id)],
    });

  /* 9. Work without a BRD: the QA lead's authored cases. */
  for (const a of input.authored ?? [])
    add({
      title: a.title,
      level: a.level,
      priority: a.priority,
      risk: a.priority === "P1" ? "high" : "medium",
      objective: `Proves ${a.workItem} works as agreed.`,
      preconditions: ["Test environment deployed from the release candidate"],
      steps: a.steps.map(([action, expected]) => ({ action, expected })),
      data: "Synthetic",
      tool: a.tool,
      automated: a.automated,
      traces: [{ kind: "work-item", id: a.workItem, label: a.workItem }],
    });

  const levels = [...new Set(cases.map((x) => x.level))];
  const region = architecture ? REGIONS[architecture.brief.cloud][architecture.brief.region] : null;
  const cloud = architecture ? CLOUD_LABEL[architecture.brief.cloud] : (project.tools.cloud ?? "Cloud");
  const where = region ? `${cloud} · ${region.primary}` : (project.tools.cloud ?? "Shared test environment");
  const team = project.teams[0] ?? "Delivery";
  const approach: TestApproach[] = levels.map((level) => ({
    level,
    objective: APPROACH[level],
    owner: OWNER[level].replace("{team}", team),
    tools: [TOOL[level]],
    environment:
      level === "performance"
        ? "Performance"
        : level === "uat"
          ? "UAT"
          : level === "resilience"
            ? "Pre-production"
            : level === "unit" || level === "contract" || level === "integration"
              ? "CI"
              : "Test",
    automationTarget: AUTOMATED[level] ? (level === "e2e" ? 80 : 95) : 0,
  }));

  const end = plan?.forecastEnd ?? project.targetDate;
  const buildStart =
    plan?.workstreams.find((w) => /build/i.test(w.name))?.start ??
    plan?.workstreams[0]?.start ??
    project.startDate;
  const golive = plan?.milestones.find((m) => m.gate === "g4");
  const schedule = [
    {
      phase: "Test design and review",
      start: addDays(buildStart, -14),
      end: addDays(buildStart, -1),
      milestone: "Test plan approved",
    },
    {
      phase: "System and integration testing (per sprint)",
      start: buildStart,
      end: addDays(end, -35),
      milestone: null,
    },
    {
      phase: "Non-functional and security testing",
      start: addDays(end, -35),
      end: addDays(end, -14),
      milestone: "Pen test report",
    },
    ...(usesAi
      ? [
          {
            phase: "AI evaluation and red-team",
            start: addDays(end, -42),
            end: addDays(end, -14),
            milestone: "Eval thresholds met",
          },
        ]
      : []),
    {
      phase: "User acceptance testing",
      start: addDays(end, -21),
      end: addDays(end, -7),
      milestone: "UAT sign-off",
    },
    {
      phase: "Go-live readiness",
      start: addDays(end, -7),
      end,
      milestone: golive ? `${golive.id} · ${golive.title}` : "Go-live (G4)",
    },
  ];

  const sev = [
    { level: "S1 Critical", meaning: "Blocks a P1 journey or exposes data", sla: "Fix before any release" },
    { level: "S2 High", meaning: "P1 journey degraded, workaround exists", sla: "Fix before go-live" },
    { level: "S3 Medium", meaning: "P2/P3 function wrong", sla: "Next sprint" },
    { level: "S4 Low", meaning: "Cosmetic", sla: "Backlog" },
  ];

  const hasSecurity = cases.some((x) => x.level === "security");
  const approvals: TestPlan["approvals"] = [
    { id: "qa", capacity: "QA lead", name: `QA lead · ${team}`, status: "pending", at: null },
    { id: "po", capacity: "Product owner", name: project.owner, status: "pending", at: null },
    ...(hasSecurity
      ? [
          {
            id: "sec",
            capacity: "Information security",
            name: "Security testing lead",
            status: "pending" as const,
            at: null,
          },
        ]
      : []),
    ...(usesAi
      ? [{ id: "ai", capacity: "AI governance", name: "AI CoE", status: "pending" as const, at: null }]
      : []),
  ];

  const draft: TestPlan = {
    id: `tp-${project.key.toLowerCase()}`,
    projectId: project.id,
    title: `${project.name} · test plan`,
    version: "0.1",
    status: "draft",
    owner: input.owner,
    basis: {
      brd: brd ? { id: brd.id, version: brd.version } : null,
      architecture: architecture ? { id: architecture.id, revision: architecture.revision } : null,
      backlog: backlog && backlog.status !== "none" ? backlog.id : null,
    },
    summary: `${cases.length} test cases across ${levels.length} levels, derived from ${[
      brd ? `${brd.id} v${brd.version}` : null,
      backlog && stories.length ? `${stories.length} backlog stories` : null,
      architecture ? `${architecture.id} (revision ${architecture.revision})` : null,
      input.authored?.length ? "the QA lead's cases for work without a BRD" : null,
    ]
      .filter(Boolean)
      .join(
        ", ",
      )}. Risk-based: P1 cases cover every Must requirement, NFR target and security control${usesAi ? ", plus AI evaluation and red-team" : ""}.`,
    scope: {
      in: [
        ...(c?.inScope ?? [
          `Work items: ${
            input.authored
              ?.map((a) => a.workItem)
              .filter((v, i, xs) => xs.indexOf(v) === i)
              .join(", ") ?? ""
          }`,
        ]),
      ],
      out: [
        ...(c?.outOfScope ?? []),
        ...(c?.requirements ?? [])
          .filter((r) => r.priority === "wont")
          .map((r) => `${r.id} ${r.title} (Won't this release)`),
      ],
    },
    approach,
    environments: [
      {
        name: "CI",
        purpose: "Unit, contract and integration tests on every pull request",
        where: "Build agents (ephemeral)",
        data: "Synthetic fixtures",
      },
      {
        name: "Test",
        purpose: "System and end-to-end tests per sprint",
        where,
        data: "Synthetic and masked data",
      },
      {
        name: "Pre-production",
        purpose: "Security, resilience and release rehearsal; production-like network",
        where,
        data: "Masked production-shaped data",
      },
      ...(levels.includes("performance")
        ? [{ name: "Performance", purpose: "Load at 2× peak", where, data: "Generated volume" }]
        : []),
      {
        name: "UAT",
        purpose: "Business acceptance with trained users",
        where,
        data: "Masked production-shaped data",
      },
      ...(region?.dr && architecture?.brief.availability.startsWith("multi")
        ? [{ name: "DR", purpose: "Failover drill", where: `${cloud} · ${region.dr}`, data: "Replica" }]
        : []),
    ],
    testData: (c?.data ?? []).map((d) => ({
      entity: d.entity,
      classification: d.classification,
      approach:
        d.classification === "restricted"
          ? "Synthetic only; never copied from production"
          : d.classification === "confidential"
            ? "Masked copy (names, contacts and identifiers replaced)"
            : "Copy allowed",
    })),
    risks: (c?.risks ?? []).map((r) => ({
      id: r.id,
      risk: r.description,
      impact: r.impact,
      mitigation: `${r.mitigation} Tested by ${Math.max(1, Math.round(cases.length / Math.max(1, c?.risks.length ?? 1) / 6))}+ P1 cases.`,
    })),
    entry: [
      ...(brd
        ? [`${brd.id} approved (currently v${brd.version}, ${brd.status})`]
        : ["Scope for each work item agreed with the product owner"]),
      ...(architecture ? [`Architecture ${architecture.id} approved at G2`] : []),
      "Test environment provisioned from infrastructure code",
      "Test data masked and loaded",
      "Stories meet the Definition of Ready",
    ],
    exit: [],
    schedule,
    roles: [
      {
        role: "QA lead",
        name: `QA lead · ${team}`,
        responsibilities: "Owns the plan, coverage and exit criteria",
      },
      { role: "Product owner", name: project.owner, responsibilities: "Approves the plan and accepts UAT" },
      {
        role: "Engineers",
        name: project.teams.join(", "),
        responsibilities: "Unit, contract and integration tests in the definition of done",
      },
      ...(hasSecurity
        ? [
            {
              role: "Security tester",
              name: "Security testing lead",
              responsibilities: "Pen test and control verification",
            },
          ]
        : []),
      ...(usesAi
        ? [
            {
              role: "AI evaluator",
              name: "AI CoE",
              responsibilities: "Evaluation sets, thresholds and red-team",
            },
          ]
        : []),
      {
        role: "Business users",
        name: `Nominated by ${project.sponsor}`,
        responsibilities: "UAT execution and sign-off",
      },
    ],
    defects: { tool: `Jira (${project.tools.jira ?? project.key})`, severities: sev },
    cases,
    runs: [],
    coverage: emptyCoverage(),
    approvals,
    target: input.target,
    pushedAt: null,
    generatedAt: input.at,
    history: [
      {
        version: "0.1",
        at: input.at,
        by: "QA agent",
        what: `Drafted ${cases.length} cases from ${brd?.id ?? "the work items"}`,
      },
    ],
  };
  return refresh(draft, brd, architecture);
}

const emptyCoverage = (): TestCoverage => ({
  requirements: { covered: 0, total: 0 },
  nfrs: { covered: 0, total: 0 },
  controls: { covered: 0, total: 0 },
  automation: 0,
  passRate: null,
  executed: 0,
});

/** Recomputes coverage and exit criteria from the cases and their latest results. */
export function refresh(plan: TestPlan, brd: Brd | null, architecture: Architecture | null): TestPlan {
  const live = plan.cases.filter((x) => x.status !== "retired");
  const traced = (kind: TestTrace["kind"]) =>
    new Set(live.flatMap((x) => x.traces.filter((t) => t.kind === kind).map((t) => t.id)));
  const reqs = (brd?.content.requirements ?? []).filter((r) => r.priority !== "wont");
  const nfrs = brd?.content.nfrs ?? [];
  const controls = architecture ? securityControls(architecture.brief) : [];
  const executed = live.filter((x) => x.result !== "not-run");
  const passed = executed.filter((x) => x.result === "pass").length;
  const failed = executed.filter((x) => x.result === "fail").length;
  const coverage: TestCoverage = {
    requirements: { covered: reqs.filter((r) => traced("requirement").has(r.id)).length, total: reqs.length },
    nfrs: { covered: nfrs.filter((x) => traced("nfr").has(x.id)).length, total: nfrs.length },
    controls: { covered: controls.filter((x) => traced("control").has(x.id)).length, total: controls.length },
    automation: live.length ? Math.round((live.filter((x) => x.automated).length / live.length) * 100) : 0,
    passRate: passed + failed ? Math.round((passed / (passed + failed)) * 100) : null,
    executed: live.length ? Math.round((executed.length / live.length) * 100) : 0,
  };
  const p1 = live.filter((x) => x.priority === "P1");
  const p1Run = p1.filter((x) => x.result !== "not-run");
  const p1Pass = p1Run.filter((x) => x.result === "pass").length;
  const mustIds = reqs.filter((r) => r.priority === "must").map((r) => r.id);
  const mustCovered = mustIds.filter((id) => traced("requirement").has(id)).length;
  const openSevere = live.filter((x) => x.result === "fail" && x.priority === "P1").length;
  const ran = executed.length > 0;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 100);
  const exit: ExitCriterion[] = [
    {
      id: "E1",
      criterion: "Every Must requirement has at least one test",
      target: "100%",
      actual: `${pct(mustCovered, mustIds.length)}%`,
      met: mustCovered === mustIds.length,
    },
    {
      id: "E2",
      criterion: "P1 cases executed",
      target: "100%",
      actual: ran ? `${pct(p1Run.length, p1.length)}%` : null,
      met: ran ? p1Run.length === p1.length : null,
    },
    {
      id: "E3",
      criterion: "P1 pass rate",
      target: "100%",
      actual: p1Run.length ? `${pct(p1Pass, p1Run.length)}%` : null,
      met: p1Run.length ? p1Pass === p1Run.length : null,
    },
    {
      id: "E4",
      criterion: "Overall pass rate",
      target: "≥ 95%",
      actual: coverage.passRate === null ? null : `${coverage.passRate}%`,
      met: coverage.passRate === null ? null : coverage.passRate >= 95,
    },
    {
      id: "E5",
      criterion: "Open S1/S2 defects",
      target: "0",
      actual: ran ? String(openSevere) : null,
      met: ran ? openSevere === 0 : null,
    },
    ...(nfrs.length
      ? [
          {
            id: "E6",
            criterion: "NFR targets verified",
            target: `${nfrs.length} of ${nfrs.length}`,
            actual: ran
              ? `${live.filter((x) => x.result === "pass" && x.traces.some((t) => t.kind === "nfr")).length} passed`
              : null,
            met: ran
              ? nfrs.every((x) =>
                  live.some((t) => t.result === "pass" && t.traces.some((r) => r.id === x.id)),
                )
              : null,
          },
        ]
      : []),
    ...(controls.length
      ? [
          {
            id: "E7",
            criterion: "Security controls verified",
            target: `${controls.length} of ${controls.length}`,
            actual: ran
              ? `${controls.filter((x) => live.some((t) => t.result === "pass" && t.traces.some((r) => r.id === x.id))).length} of ${controls.length}`
              : null,
            met: ran
              ? controls.every((x) =>
                  live.some((t) => t.result === "pass" && t.traces.some((r) => r.id === x.id)),
                )
              : null,
          },
        ]
      : []),
    ...(live.some((x) => x.level === "ai-eval")
      ? [
          {
            id: "E8",
            criterion: "AI evaluation thresholds met",
            target: "All evals pass",
            actual: live.filter((x) => x.level === "ai-eval" && x.result !== "not-run").length
              ? `${live.filter((x) => x.level === "ai-eval" && x.result === "pass").length} of ${live.filter((x) => x.level === "ai-eval").length}`
              : null,
            met: live.filter((x) => x.level === "ai-eval" && x.result !== "not-run").length
              ? live.filter((x) => x.level === "ai-eval").every((x) => x.result === "pass")
              : null,
          },
        ]
      : []),
  ];
  return { ...plan, coverage, exit };
}

/** Small deterministic hash so seeded results are stable. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Final avalanche (murmur3 fmix32) so near-identical ids don't get near-identical values.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Applies a CI run: executes the share of automated (and manual) cases given, with a pass rate. */
export function applyRun(
  plan: TestPlan,
  opts: {
    id: string;
    at: string;
    source: string;
    environment: string;
    executed: number;
    pass: number;
    defectPrefix: string;
  },
): TestPlan {
  let defect = 100 + plan.runs.length * 10;
  const cases = plan.cases.map((x) => {
    if (x.status === "retired") return x;
    const roll = hash(`${opts.id}:${x.id}`);
    const runs = (x.automated ? roll : roll * 1.6) < opts.executed;
    if (!runs) return x;
    const ok = hash(`${x.id}:${opts.id}:r`) < opts.pass;
    const blocked = !ok && hash(`${x.id}:b`) < 0.15;
    if (!ok && !blocked) defect += 1;
    return {
      ...x,
      result: ok ? ("pass" as const) : blocked ? ("blocked" as const) : ("fail" as const),
      lastRunAt: opts.at,
      defects: ok || blocked ? x.defects : [...x.defects, `${opts.defectPrefix}-${defect}`],
    };
  });
  const counted = cases.filter((x) => x.status !== "retired");
  const run: TestRun = {
    id: opts.id,
    at: opts.at,
    source: opts.source,
    environment: opts.environment,
    passed: counted.filter((x) => x.lastRunAt === opts.at && x.result === "pass").length,
    failed: counted.filter((x) => x.lastRunAt === opts.at && x.result === "fail").length,
    blocked: counted.filter((x) => x.lastRunAt === opts.at && x.result === "blocked").length,
    notRun: counted.filter((x) => x.result === "not-run").length,
    durationMin: Math.round(12 + hash(opts.id) * 40),
  };
  return { ...plan, cases, runs: [run, ...plan.runs] };
}

const EXPECTED: Record<"happy" | "negative" | "edge" | "nfr", string> = {
  happy: "Completes as described",
  negative: "Refused with a clear message; nothing changes; the attempt is logged",
  edge: "Handled without error; data stays consistent",
  nfr: "Meets the stated target",
};

const STEP_FOR: Partial<Record<TestLevel, string>> = {
  performance: "Run the load profile at 2× expected peak for 30 minutes and record percentiles",
  resilience: "Kill an instance and a zone during load; then restore",
  security: "Run the security test suite and targeted manual checks",
  accessibility: "Run axe-core on every screen and a screen-reader walkthrough",
  data: "Check retention, residency and audit settings against policy",
  system: "Generate the report or view and reconcile it with source data",
};

const CONTROL_TEST: Record<string, string> = {
  C1: "Scan every endpoint for TLS versions and ciphers; try plain HTTP",
  C2: "Send OWASP Top 10 payloads and burst traffic to the edge",
  C3: "Call with expired, wrong-audience, wrong-issuer and unsigned tokens",
  C4: "Call a service from an unauthorised pod or without a client certificate",
  C5: "Try to reach the database, cache and storage from the internet",
  C6: "Scan code, images and configuration for secrets",
  C7: "Revoke the encryption key in a test vault and read data",
  C8: "Call a destination that isn't on the egress allow-list",
  C9: "Connect to the partner endpoint without the client certificate",
  C10: "Try to administer production without a just-in-time approval",
  C11: "Deploy an unsigned image",
  C12: "Perform a sensitive action and look for its audit record in the SIEM",
  C13: "Send prompt-injection and data-exfiltration prompts to the model path",
  C14: "Create a resource or replica outside the approved region",
};
const CONTROL_TOOL: Record<string, string> = {
  C1: "testssl.sh",
  C2: "OWASP ZAP",
  C3: "API security tests",
  C6: "gitleaks + image scan",
  C11: "cosign verify",
  C14: "Azure Policy / policy scan",
};

const AI_EVALS: {
  title: string;
  objective: string;
  priority: TestPriority;
  tool: string;
  steps: [string, string][];
}[] = [
  {
    title: "Accuracy on the golden evaluation set",
    objective: "The agent's decisions meet the agreed quality bar before it touches live work.",
    priority: "P1",
    tool: "Eval harness (golden set)",
    steps: [
      [
        "Run the versioned golden set (≥ 500 labelled examples) through the release candidate",
        "Accuracy meets {target}",
      ],
      [
        "Break results down by language, channel and category",
        "No segment more than 5 points below the average",
      ],
    ],
  },
  {
    title: "Prompt-injection and jailbreak red-team",
    objective:
      "Instructions hidden in user input or tool results can't make the agent act outside its allow-list.",
    priority: "P1",
    tool: "Red-team suite + manual",
    steps: [
      [
        "Feed injection payloads through every input and tool result",
        "Blocked or ignored; no tool called outside the allow-list",
      ],
      ["Attempt data exfiltration via crafted inputs", "No restricted data leaves; attempt flagged"],
    ],
  },
  {
    title: "Grounding: no unsupported claims",
    objective: "Drafts and answers are supported by approved sources.",
    priority: "P1",
    tool: "Eval harness (groundedness)",
    steps: [
      [
        "Score responses for groundedness against cited sources",
        "≥ 95% grounded; ungrounded answers routed to a person",
      ],
    ],
  },
  {
    title: "Personal data never reaches the model or logs unmasked",
    objective: "Privacy controls hold for every path to the model.",
    priority: "P1",
    tool: "PII scanner on prompts and logs",
    steps: [
      [
        "Send messages full of personal data and inspect prompts, traces and logs",
        "No unmasked personal data anywhere",
      ],
    ],
  },
  {
    title: "Kill switch and fallback to people",
    objective: "The agent can be stopped and work continues safely.",
    priority: "P1",
    tool: "Manual drill",
    steps: [
      [
        "Switch the agent off for one intent or server during a run",
        "Stops within the agreed time; items routed to people",
      ],
      ["Switch it back on", "Resumes without duplicates"],
    ],
  },
  {
    title: "Shadow-mode comparison with human decisions",
    objective: "Before go-live, the agent agrees with people often enough to be trusted.",
    priority: "P2",
    tool: "Shadow-mode report",
    steps: [
      [
        "Run the agent in shadow mode for 2 weeks and compare with human outcomes",
        "Agreement meets {target}; disagreements reviewed",
      ],
    ],
  },
  {
    title: "Cost and latency budget per request",
    objective: "Model calls stay within the budget at peak.",
    priority: "P2",
    tool: "k6 + token metering",
    steps: [
      [
        "Run peak load and meter tokens and latency per request",
        "p95 latency and cost per item within budget",
      ],
    ],
  },
];

const APPROACH: Record<TestLevel, string> = {
  unit: "Every function with business logic; run on every commit",
  contract: "Consumer-driven contracts with every external system; breaking changes fail the build",
  integration: "Services with their real dependencies in containers",
  system: "Every acceptance criterion through the API, including negative and edge paths",
  e2e: "Critical user journeys through the UI on the release candidate",
  uat: "Business users confirm the objectives with real scenarios",
  performance: "Load at 2× peak against NFR targets",
  security: "Controls from the architecture, OWASP Top 10, and a pen test before go-live",
  resilience: "Backups, retries, dead-letter, zone loss and regional failover",
  accessibility: "WCAG 2.2 AA on every screen",
  "ai-eval": "Golden-set accuracy, groundedness, red-team, privacy and kill switch",
  data: "Retention, residency and audit evidence",
};
const OWNER: Record<TestLevel, string> = {
  unit: "{team} engineers",
  contract: "{team} engineers",
  integration: "{team} engineers",
  system: "QA · {team}",
  e2e: "QA · {team}",
  uat: "Product owner + business users",
  performance: "Performance engineer",
  security: "Security testing lead",
  resilience: "SRE",
  accessibility: "QA · {team}",
  "ai-eval": "AI CoE evaluator",
  data: "Data protection officer + QA",
};
