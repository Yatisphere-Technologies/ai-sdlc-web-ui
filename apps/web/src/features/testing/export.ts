import { TEST_LEVEL_LABEL, type TestCase, type TestPlan } from "@throughline/contracts";

/* Import files for the three test tools. Column names follow each tool's CSV importer template;
 * the importers still show a field-mapping step, where these headers map one to one. */

const cell = (v: string | number | boolean | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};
const csv = (rows: (string | number | boolean | null | undefined)[][]) =>
  `${rows.map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;

const live = (plan: TestPlan) => plan.cases.filter((c) => c.status !== "retired");
const requirementKeys = (c: TestCase) =>
  c.traces.filter((t) => t.kind === "story" || t.kind === "work-item").map((t) => t.id);
const labels = (c: TestCase) =>
  [c.level, c.automated ? "automated" : "manual", c.risk === "high" ? "high-risk" : null]
    .filter(Boolean)
    .join(" ");
const stepsOf = (c: TestCase) =>
  c.steps.length ? c.steps : [{ action: c.objective, expected: "As described" }];

const JIRA_PRIORITY = { P1: "High", P2: "Medium", P3: "Low" } as const;
const ZEPHYR_PRIORITY = { P1: "High", P2: "Normal", P3: "Low" } as const;
const ADO_PRIORITY = { P1: 1, P2: 2, P3: 3 } as const;

/** Xray Test Case Importer: one row per step; case fields on its first row, grouped by TCID. */
export function xrayCsv(plan: TestPlan): string {
  const rows: (string | number | null)[][] = [
    [
      "TCID",
      "Summary",
      "Description",
      "Priority",
      "Labels",
      "Test Type",
      "Action",
      "Data",
      "Expected Result",
      "Requirements",
    ],
  ];
  live(plan).forEach((c, i) => {
    stepsOf(c).forEach((s, j) => {
      rows.push(
        j === 0
          ? [
              i + 1,
              c.title,
              `${c.objective}${c.preconditions.length ? `\n\nPreconditions:\n- ${c.preconditions.join("\n- ")}` : ""}`,
              JIRA_PRIORITY[c.priority],
              labels(c),
              c.automated ? "Generic" : "Manual",
              s.action,
              c.data,
              s.expected,
              requirementKeys(c).join(" "),
            ]
          : [i + 1, null, null, null, null, null, s.action, null, s.expected, null],
      );
    });
  });
  return csv(rows);
}

/** Zephyr Scale CSV import: one row per step; continuation rows leave Name empty. */
export function zephyrCsv(plan: TestPlan, folder = `/${plan.title}`): string {
  const rows: (string | null)[][] = [
    [
      "Name",
      "Objective",
      "Precondition",
      "Status",
      "Priority",
      "Labels",
      "Folder",
      "Test Script (Step-by-Step) - Step",
      "Test Script (Step-by-Step) - Test Data",
      "Test Script (Step-by-Step) - Expected Result",
      "Coverage (Issues)",
    ],
  ];
  for (const c of live(plan)) {
    stepsOf(c).forEach((s, j) => {
      rows.push(
        j === 0
          ? [
              c.title,
              c.objective,
              c.preconditions.join("\n"),
              c.status === "approved" ? "Approved" : "Draft",
              ZEPHYR_PRIORITY[c.priority],
              labels(c).replaceAll(" ", ","),
              `${folder}/${TEST_LEVEL_LABEL[c.level]}`,
              s.action,
              c.data,
              s.expected,
              requirementKeys(c).join(","),
            ]
          : [null, null, null, null, null, null, null, s.action, null, s.expected, null],
      );
    });
  }
  return csv(rows);
}

/** Azure Test Plans "Import test cases" CSV: a Test Case row, then one row per step. */
export function azureTestPlansCsv(plan: TestPlan, areaPath: string): string {
  const rows: (string | number | null)[][] = [
    [
      "ID",
      "Work Item Type",
      "Title",
      "Test Step",
      "Step Action",
      "Step Expected",
      "Priority",
      "Area Path",
      "Assigned To",
      "State",
    ],
  ];
  for (const c of live(plan)) {
    const steps = stepsOf(c);
    rows.push([
      c.external && /^\d+$/.test(c.external) ? c.external : null,
      "Test Case",
      c.title,
      1,
      steps[0]?.action ?? "",
      steps[0]?.expected ?? "",
      ADO_PRIORITY[c.priority],
      areaPath,
      plan.owner,
      c.status === "approved" ? "Ready" : "Design",
    ]);
    steps.slice(1).forEach((s, j) => {
      rows.push([null, null, null, j + 2, s.action, s.expected, null, null, null, null]);
    });
  }
  return csv(rows);
}

const table = (head: string[], rows: string[][]) =>
  [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...rows.map((r) => `| ${r.map((x) => x.replaceAll("|", "\\|").replaceAll("\n", " ")).join(" | ")} |`),
  ].join("\n");

/** The whole plan as a Markdown document (ISO/IEC/IEEE 29119-3 section order). */
export function testPlanMarkdown(plan: TestPlan, projectName: string): string {
  const out: string[] = [];
  out.push(`# ${plan.title}`, "");
  out.push(
    `**Project:** ${projectName} · **Version:** ${plan.version} · **Status:** ${plan.status} · **Owner:** ${plan.owner}`,
    "",
  );
  const basis = [
    plan.basis.brd ? `${plan.basis.brd.id} v${plan.basis.brd.version}` : null,
    plan.basis.backlog,
    plan.basis.architecture ? `${plan.basis.architecture.id} r${plan.basis.architecture.revision}` : null,
  ].filter(Boolean);
  out.push(`**Basis:** ${basis.join(" · ") || "none"}`, "", "## 1. Summary", "", plan.summary, "");
  out.push("## 2. Scope", "", "**In scope**", "", ...plan.scope.in.map((x) => `- ${x}`), "");
  out.push("**Out of scope**", "", ...plan.scope.out.map((x) => `- ${x}`), "");
  out.push(
    "## 3. Approach",
    "",
    table(
      ["Level", "Objective", "Owner", "Tools", "Environment", "Automation target"],
      plan.approach.map((a) => [
        TEST_LEVEL_LABEL[a.level],
        a.objective,
        a.owner,
        a.tools.join(", "),
        a.environment,
        `${a.automationTarget}%`,
      ]),
    ),
    "",
  );
  out.push(
    "## 4. Environments",
    "",
    table(
      ["Name", "Purpose", "Where", "Data"],
      plan.environments.map((e) => [e.name, e.purpose, e.where, e.data]),
    ),
    "",
  );
  out.push(
    "## 5. Test data",
    "",
    table(
      ["Entity", "Classification", "Approach"],
      plan.testData.map((d) => [d.entity, d.classification, d.approach]),
    ),
    "",
  );
  out.push(
    "## 6. Risks",
    "",
    table(
      ["ID", "Risk", "Impact", "Mitigation"],
      plan.risks.map((r) => [r.id, r.risk, r.impact, r.mitigation]),
    ),
    "",
  );
  out.push("## 7. Entry criteria", "", ...plan.entry.map((x) => `- ${x}`), "");
  out.push(
    "## 8. Exit criteria",
    "",
    table(
      ["ID", "Criterion", "Target", "Actual", "Met"],
      plan.exit.map((e) => [
        e.id,
        e.criterion,
        e.target,
        e.actual ?? "-",
        e.met === null ? "-" : e.met ? "Yes" : "No",
      ]),
    ),
    "",
  );
  out.push(
    "## 9. Schedule",
    "",
    table(
      ["Phase", "Start", "End", "Milestone"],
      plan.schedule.map((s) => [s.phase, s.start, s.end, s.milestone ?? ""]),
    ),
    "",
  );
  out.push(
    "## 10. Roles",
    "",
    table(
      ["Role", "Name", "Responsibilities"],
      plan.roles.map((r) => [r.role, r.name, r.responsibilities]),
    ),
    "",
  );
  out.push(
    "## 11. Defect management",
    "",
    `Tracked in ${plan.defects.tool}.`,
    "",
    table(
      ["Severity", "Meaning", "SLA"],
      plan.defects.severities.map((s) => [s.level, s.meaning, s.sla]),
    ),
    "",
  );
  out.push(
    "## 12. Coverage",
    "",
    `- Requirements: ${plan.coverage.requirements.covered}/${plan.coverage.requirements.total}`,
    `- NFRs: ${plan.coverage.nfrs.covered}/${plan.coverage.nfrs.total}`,
    `- Security controls: ${plan.coverage.controls.covered}/${plan.coverage.controls.total}`,
    `- Automated: ${plan.coverage.automation}%`,
    `- Executed: ${plan.coverage.executed}%${plan.coverage.passRate === null ? "" : ` · pass rate ${plan.coverage.passRate}%`}`,
    "",
  );
  out.push("## 13. Test cases", "");
  for (const c of live(plan)) {
    out.push(`### ${c.id} · ${c.title}`, "");
    out.push(
      `${TEST_LEVEL_LABEL[c.level]} · ${c.priority} · risk ${c.risk} · ${c.automated ? `automated (${c.tool})` : "manual"}${c.external ? ` · ${c.external}` : ""}`,
      "",
      c.objective,
      "",
    );
    if (c.preconditions.length)
      out.push("**Preconditions:**", "", ...c.preconditions.map((p) => `- ${p}`), "");
    if (c.steps.length)
      out.push(
        table(
          ["#", "Action", "Expected"],
          c.steps.map((s, i) => [String(i + 1), s.action, s.expected]),
        ),
        "",
      );
    out.push(`**Traces to:** ${c.traces.map((t) => t.id).join(", ")}`, "");
  }
  out.push(
    "## Approvals",
    "",
    table(
      ["Capacity", "Name", "Status"],
      plan.approvals.map((a) => [a.capacity, a.name, a.status]),
    ),
    "",
  );
  return out.join("\n");
}
