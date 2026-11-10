import type { TestPlan, TestTool } from "@throughline/contracts";
import type { TenantSeed } from "../seed/types";
import { type AuthoredCase, applyRun, generateTestPlan, refresh } from "./generate";

/**
 * How each seeded project's test plan looks today: who has approved it, whether it has been
 * pushed to the test tool, and which CI runs have reported results. Cases for work items that
 * have no BRD are authored here (the QA lead wrote them).
 */
export type TestProfile = {
  owner: string;
  target: TestTool;
  version: string;
  status: TestPlan["status"];
  approved: string[];
  pushedAt?: string;
  authored?: AuthoredCase[];
  runs?: { id: string; at: string; source: string; environment: string; executed: number; pass: number }[];
};

const A = (
  workItem: string,
  title: string,
  level: AuthoredCase["level"],
  priority: AuthoredCase["priority"],
  steps: [string, string][],
  automated?: boolean,
): AuthoredCase => ({ workItem, title, level, priority, steps, automated });

export function buildTestPlans(
  seed: Omit<TenantSeed, "testPlans" | "assistant">,
  profiles: Record<string, TestProfile>,
): TestPlan[] {
  return seed.projects.map((project) => {
    const p = profiles[project.key];
    if (!p) throw new Error(`No test profile for project ${project.key}`);
    // The plan is built from the project's main BRD (the approved one if there is one).
    const recs = seed.brds.filter((r) => r.brd.projectId === project.id);
    const rec = recs.find((r) => r.brd.status === "approved") ?? recs[0];
    const architecture =
      seed.architectures.find(
        (a) => a.architecture.projectId === project.id && a.architecture.workItemKey === rec?.brd.workItemKey,
      )?.architecture ??
      seed.architectures.find((a) => a.architecture.projectId === project.id)?.architecture ??
      null;
    let plan = generateTestPlan({
      project,
      brd: rec?.brd ?? null,
      backlog: rec && rec.backlog.status !== "none" ? rec.backlog : null,
      architecture,
      plan: seed.plans.find((x) => x.projectId === project.id) ?? null,
      authored: p.authored,
      target: p.target,
      owner: p.owner,
      at: "2026-10-22T09:00:00Z",
    });
    const approved = p.status === "approved" || p.status === "in-review";
    plan = {
      ...plan,
      version: p.version,
      status: p.status,
      approvals: plan.approvals.map((x) =>
        p.approved.includes(x.id) ? { ...x, status: "approved" as const, at: "2026-10-23T12:00:00Z" } : x,
      ),
      cases: plan.cases.map((x) => ({ ...x, status: approved ? ("approved" as const) : ("ready" as const) })),
      history: [
        ...plan.history,
        ...(approved
          ? [
              {
                version: p.version,
                at: "2026-10-23T12:00:00Z",
                by: p.owner,
                what: p.status === "approved" ? "Approved" : "Submitted for approval",
              },
            ]
          : []),
      ],
    };
    if (p.pushedAt) plan = pushPlan(plan, p.target, project.tools.jira ?? project.key, p.pushedAt);
    for (const r of p.runs ?? [])
      plan = applyRun(plan, { ...r, defectPrefix: project.tools.jira ?? project.key });
    return refresh(plan, rec?.brd ?? null, architecture);
  });
}

/** Gives every case a key in the test tool, the way each tool numbers them. */
export function pushPlan(plan: TestPlan, target: TestTool, key: string, at: string): TestPlan {
  let seq = 0;
  return {
    ...plan,
    target,
    pushedAt: at,
    cases: plan.cases.map((x) => {
      seq += 1;
      const external =
        target === "zephyr"
          ? `${key}-T${seq}`
          : target === "xray"
            ? `${key}-${700 + seq}`
            : String(48000 + seq);
      return { ...x, external };
    }),
  };
}

/* ── Acme ─────────────────────────────────────────────────────────────────────────────────────── */

export const acmeTestProfiles: Record<string, TestProfile> = {
  UPI: {
    owner: "Deepa Krishnan · QA lead",
    target: "xray",
    version: "1.0",
    status: "approved",
    approved: ["qa", "po", "sec"],
    pushedAt: "2026-10-14T08:00:00Z",
    authored: [
      A("INT-29", "Duplicate cancel request with the same idempotency key", "integration", "P1", [
        [
          "Send the same cancel request twice within 1 second",
          "One cancellation; second call returns the first result",
        ],
      ]),
      A("INT-29", "Idempotency key expires after 30 days", "integration", "P2", [
        ["Reuse a key older than 30 days", "Treated as a new request"],
      ]),
      A("INT-29", "Concurrent requests with one key across pods", "integration", "P1", [
        [
          "Fire 50 parallel requests with one key across 3 pods",
          "Exactly one is processed; others get the same response",
        ],
      ]),
      A("INT-25", "PSP timeout triggers the retry rule (RUL-19)", "system", "P2", [
        ["Make the PSP sandbox time out on revoke", "Retried 5 times with backoff; then an ops case"],
      ]),
    ],
    runs: [
      {
        id: "ci-412",
        at: "2026-10-20T18:20:00Z",
        source: "GitHub Actions · mandate-svc run 412",
        environment: "Test",
        executed: 0.55,
        pass: 0.86,
      },
      {
        id: "ci-431",
        at: "2026-10-24T18:05:00Z",
        source: "GitHub Actions · mandate-svc run 431",
        environment: "Test",
        executed: 0.75,
        pass: 0.9,
      },
    ],
  },
  MRC: {
    owner: "Deepa Krishnan · QA lead",
    target: "xray",
    version: "1.0",
    status: "approved",
    approved: ["qa", "po"],
    pushedAt: "2026-09-20T08:00:00Z",
    authored: [
      A("INT-27", "Settlement report v2 totals reconcile with the ledger", "system", "P1", [
        ["Generate the report for a closed settlement day", "Totals equal the ledger to the paisa"],
      ]),
      A("INT-27", "Report delivered to merchants by 09:00 IST", "system", "P1", [
        ["Run the scheduled job for 500 merchants", "All files delivered before 09:00 IST"],
      ]),
      A("INT-27", "Merchant sees only their own settlements", "security", "P1", [
        ["Request another merchant's report id", "403; attempt logged"],
      ]),
      A("INT-27", "Report download on the merchant portal", "e2e", "P2", [
        ["Download CSV and PDF", "Both open and match"],
      ]),
      A("INT-34", "Bulk refund export of 10,000 rows", "performance", "P2", [
        ["Export 10,000 refunds", "Completes within 60 s; file valid"],
      ]),
      A("INT-34", "Refund export respects the date filter", "system", "P2", [
        ["Filter by a date range", "Only refunds in range"],
      ]),
    ],
    runs: [
      {
        id: "ci-205",
        at: "2026-10-23T17:40:00Z",
        source: "GitHub Actions · merchant-reports run 205",
        environment: "Test",
        executed: 0.5,
        pass: 0.92,
      },
    ],
  },
  CARD: {
    owner: "Rohan Desai · QA lead",
    target: "xray",
    version: "1.2",
    status: "approved",
    approved: ["qa", "po"],
    pushedAt: "2026-08-10T08:00:00Z",
    authored: [
      A("INT-18", "Card is provisioned as a network token", "integration", "P1", [
        ["Tokenise a test card with the network sandbox", "Token returned; PAN never stored"],
      ]),
      A("INT-18", "Token lifecycle: suspend, resume, delete", "integration", "P1", [
        ["Suspend, resume and delete a token", "Each state change confirmed by the network"],
      ]),
      A("INT-18", "Payment with a network token", "e2e", "P1", [
        ["Pay with the tokenised card", "Authorised; cryptogram valid"],
      ]),
      A("INT-18", "No PAN in logs or the database", "security", "P1", [
        ["Scan logs and tables after tokenisation", "No PAN found"],
      ]),
      A("INT-18", "Network token service down", "resilience", "P1", [
        ["Make the token service unavailable", "Falls back to the vault; alert raised"],
      ]),
      A("INT-33", "Statement PDF matches the transaction list", "system", "P2", [
        ["Generate a statement", "Every transaction present, totals correct"],
      ]),
      A("INT-33", "Statement PDF is accessible", "accessibility", "P2", [
        ["Check the PDF with a screen reader", "Tagged, readable in order"],
      ]),
      A("INT-36", "Tuned fraud rules don't raise false positives", "system", "P2", [
        ["Replay last month's transactions against the new rules", "False positives down; no missed fraud"],
      ]),
    ],
    runs: [
      {
        id: "ci-880",
        at: "2026-10-18T19:00:00Z",
        source: "Azure Pipelines · card-vault run 880",
        environment: "Test",
        executed: 0.7,
        pass: 0.72,
      },
      {
        id: "ci-894",
        at: "2026-10-25T19:00:00Z",
        source: "Azure Pipelines · card-vault run 894",
        environment: "Test",
        executed: 0.85,
        pass: 0.7,
      },
    ],
  },
  KYC: {
    owner: "Rohan Desai · QA lead",
    target: "xray",
    version: "1.1",
    status: "approved",
    approved: ["qa", "po"],
    pushedAt: "2026-07-01T08:00:00Z",
    authored: [
      A("INT-22", "Dormant account alert after 12 months without activity", "system", "P1", [
        ["Age a test account past 12 months", "Alert raised to the KYC queue"],
      ]),
      A("INT-22", "No alert for accounts with recent activity", "system", "P1", [
        ["Post one transaction", "No alert"],
      ]),
      A("INT-22", "Alert volume at 25% rollout", "performance", "P2", [
        ["Run nightly job on 25% of accounts", "Completes within 30 minutes"],
      ]),
      A("INT-22", "Customer notified in their language", "e2e", "P2", [
        ["Trigger alert for a Hindi-preference customer", "SMS in Hindi"],
      ]),
      A("INT-35", "Merchant KYC re-check scheduled on time", "system", "P1", [
        ["Merchant reaches re-check date", "Case created on the day"],
      ]),
      A("INT-35", "Re-check evidence retained for 8 years", "data", "P1", [
        ["Check retention policy on the evidence store", "8-year retention, immutable"],
      ]),
    ],
    runs: [
      {
        id: "ci-301",
        at: "2026-10-10T18:00:00Z",
        source: "GitHub Actions · kyc-engine run 301",
        environment: "Pre-production",
        executed: 0.95,
        pass: 0.95,
      },
      {
        id: "ci-322",
        at: "2026-10-24T18:00:00Z",
        source: "GitHub Actions · kyc-engine run 322",
        environment: "Pre-production",
        executed: 1,
        pass: 0.97,
      },
    ],
  },
  SUP: {
    owner: "Deepa Krishnan · QA lead",
    target: "xray",
    version: "1.0",
    status: "approved",
    approved: ["qa", "po", "sec", "ai"],
    pushedAt: "2026-10-23T14:00:00Z",
  },
  MCP: {
    owner: "Anand Pillai · QA lead (platform)",
    target: "xray",
    version: "0.9",
    status: "in-review",
    approved: ["qa", "po"],
  },
};

/* ── Northwind ────────────────────────────────────────────────────────────────────────────────── */

export const northwindTestProfiles: Record<string, TestProfile> = {
  ISO: {
    owner: "Sara Al Hashimi · QA lead",
    target: "azure-test-plans",
    version: "0.4",
    status: "draft",
    approved: [],
    authored: [
      A("INT-185", "Legacy SWIFT gateway decommissioned without message loss", "resilience", "P1", [
        [
          "Cut over to the new route during the Saturday window",
          "All queued MT messages delivered; none duplicated",
        ],
      ]),
      A("INT-201", "Translation layer maps MT103 to pacs.008", "contract", "P1", [
        ["Translate the MT103 sample set", "Every field mapped per the CBPR+ guide"],
      ]),
    ],
  },
  ONB: {
    owner: "Sara Al Hashimi · QA lead",
    target: "azure-test-plans",
    version: "0.2",
    status: "draft",
    approved: [],
    authored: [
      A("INT-212", "Sanctions screening retried on provider timeout", "integration", "P1", [
        ["Make the screening provider time out", "Retried 3 times; case held, never auto-approved"],
      ]),
      A("INT-212", "No onboarding approved while screening is pending", "system", "P1", [
        ["Approve with screening pending", "Refused"],
      ]),
      A("INT-208", "Onboarding SLA timer starts at document receipt", "system", "P2", [
        ["Upload the last document", "Timer starts; SLA shown"],
      ]),
    ],
  },
  CBS: {
    owner: "Karim Nasser · QA lead",
    target: "azure-test-plans",
    version: "1.0",
    status: "approved",
    approved: ["qa", "po"],
    pushedAt: "2026-09-01T08:00:00Z",
    authored: [
      A("INT-190", "New interest calc matches legacy for 1M accounts (parallel run)", "system", "P1", [
        ["Run both engines on the same day's balances", "Difference under 0.01 AED per account"],
      ]),
      A("INT-190", "Leap year and month-end accruals", "unit", "P1", [
        ["Accrue across 29 Feb and month-end", "Matches the product rules"],
      ]),
      A("INT-190", "Rate change mid-period", "unit", "P1", [
        ["Change the rate on the 15th", "Accrual splits at the change date"],
      ]),
      A("INT-190", "End-of-day batch within the window", "performance", "P1", [
        ["Run EOD for 1.2M accounts", "Under 45 minutes"],
      ]),
      A("INT-190", "Audit trail for every rate change", "data", "P2", [
        ["Change a rate", "Audit record with maker and checker"],
      ]),
    ],
    runs: [
      {
        id: "ado-77",
        at: "2026-10-22T20:00:00Z",
        source: "Azure Pipelines · core-interest run 77",
        environment: "Test",
        executed: 0.6,
        pass: 0.84,
      },
    ],
  },
};

/* ── Fabrikam ─────────────────────────────────────────────────────────────────────────────────── */

export const fabrikamTestProfiles: Record<string, TestProfile> = {
  LOY: {
    owner: "Mia Hoffmann · QA lead",
    target: "zephyr",
    version: "0.1",
    status: "draft",
    approved: [],
  },
  CHK: {
    owner: "Mia Hoffmann · QA lead",
    target: "zephyr",
    version: "1.0",
    status: "approved",
    approved: ["qa", "po"],
    pushedAt: "2026-10-01T08:00:00Z",
    authored: [
      A("INT-14", "Basket discount applied once per basket", "system", "P1", [
        ["Apply two codes", "Only the best one applies"],
      ]),
      A("INT-14", "Discount API p95 under 120 ms", "performance", "P1", [
        ["Load at 400 rps", "p95 < 120 ms"],
      ]),
      A("INT-14", "Expired code refused", "system", "P2", [["Use an expired code", "Refused with reason"]]),
      A("INT-14", "Contract with the checkout front end", "contract", "P1", [
        ["Run the consumer contract", "Verified"],
      ]),
    ],
    runs: [
      {
        id: "gh-58",
        at: "2026-10-24T16:00:00Z",
        source: "GitHub Actions · checkout run 58",
        environment: "Test",
        executed: 0.55,
        pass: 0.95,
      },
    ],
  },
};
