import type {
  ArtifactLink,
  ArtifactRef,
  Milestone,
  Program,
  Project,
  ProjectPlan,
  WorkItem,
  Workstream,
} from "@throughline/contracts";

/**
 * Programs, projects, plans and links for each tenant. Every work item is placed in a project
 * (`placeWorkItems` throws if one is missing), and every BRD and architecture carries a projectId,
 * so nothing in the seed is orphaned. A test checks this for all tenants.
 */

export type StoredLink = Omit<ArtifactLink, "state">;

export type TenantProjects = {
  programs: Program[];
  projects: Project[];
  plans: ProjectPlan[];
  links: StoredLink[];
};

export function placeWorkItems(items: WorkItem[], map: Record<string, string>): WorkItem[] {
  return items.map((w) => {
    const projectId = map[w.key];
    if (!projectId) throw new Error(`Work item ${w.key} has no project`);
    return { ...w, projectId };
  });
}

const ref = (type: ArtifactRef["type"], id: string): ArtifactRef => ({ type, id });

const ws = (
  id: string,
  name: string,
  owner: string,
  start: string,
  end: string,
  progress: number,
  status: Workstream["status"],
  refs: ArtifactRef[] = [],
): Workstream => ({ id, name, owner, start, end, progress, status, refs });

const ms = (
  id: string,
  title: string,
  due: string,
  status: Milestone["status"],
  owner: string,
  opts: { gate?: Milestone["gate"]; refs?: ArtifactRef[]; dependsOn?: string[] } = {},
): Milestone => ({
  id,
  title,
  due,
  status,
  owner,
  gate: opts.gate ?? null,
  refs: opts.refs ?? [],
  dependsOn: opts.dependsOn ?? [],
});

const plan = (
  projectId: string,
  version: string,
  baselineEnd: string,
  forecastEnd: string,
  workstreams: Workstream[],
  milestones: Milestone[],
): ProjectPlan => ({
  id: `plan-${projectId.replace(/^prj-/, "")}`,
  projectId,
  version,
  baselineEnd,
  forecastEnd,
  workstreams,
  milestones,
  updatedAt: "2026-10-24T09:00:00Z",
});

const link = (
  id: string,
  from: ArtifactRef,
  kind: StoredLink["kind"],
  to: ArtifactRef,
  version: string | null,
  note: string,
): StoredLink => ({ id, from, kind, to, version, note });

/* ── Acme Payments ────────────────────────────────────────────────────────────────────────────── */

export const acmeWorkMap: Record<string, string> = {
  "INT-31": "prj-upi",
  "INT-29": "prj-upi",
  "INT-25": "prj-upi",
  "INT-34": "prj-mrc",
  "INT-27": "prj-mrc",
  "INT-18": "prj-card",
  "INT-33": "prj-card",
  "INT-36": "prj-card",
  "INT-35": "prj-kyc",
  "INT-22": "prj-kyc",
  "INT-40": "prj-sup",
  "INT-52": "prj-mcp",
};

export const acmeProjects: TenantProjects = {
  programs: [
    {
      id: "pgm-pay",
      key: "PAY",
      name: "Payments modernisation",
      objective:
        "Move Acme's payment journeys to real-time, self-service flows that meet NPCI and RBI rules without growing operations headcount.",
      sponsor: "Rahul Mehta · Head of payments products",
      owner: "Priya Nair",
      status: "active",
      health: "at-risk",
      horizon: "FY27 H1",
      budgetUsd: 1_800_000,
      outcomes: [
        { metric: "Payment changes customers make themselves", baseline: "22%", target: "70%" },
        { metric: "Operations tickets per 10,000 mandates", baseline: "41", target: "≤ 10" },
      ],
    },
    {
      id: "pgm-risk",
      key: "RISK",
      name: "Risk and compliance",
      objective: "Keep KYC and dormant-account controls on time and evidenced for RBI inspections.",
      sponsor: "Meera Iyer · Head of compliance",
      owner: "Anita Rao",
      status: "active",
      health: "on-track",
      horizon: "FY27",
      budgetUsd: 650_000,
      outcomes: [{ metric: "KYC re-checks completed on time", baseline: "76%", target: "98%" }],
    },
    {
      id: "pgm-ai",
      key: "AIOPS",
      name: "AI-enabled operations",
      objective:
        "Use governed AI agents to take routine work off operations teams, with every agent identified, controlled and audited.",
      sponsor: "Sanjay Menon · COO",
      owner: "Neha Gupta · AI CoE lead",
      status: "active",
      health: "at-risk",
      horizon: "FY27",
      budgetUsd: 1_200_000,
      outcomes: [
        { metric: "Median first response to support email", baseline: "9.5 h", target: "≤ 2 h" },
        { metric: "Agent tool calls through the governed gateway", baseline: "0%", target: "100%" },
      ],
    },
  ],
  projects: [
    {
      id: "prj-upi",
      key: "UPI",
      programId: "pgm-pay",
      name: "UPI AutoPay self-service",
      objective:
        "Let customers cancel UPI AutoPay mandates in the app, with PSP revocation and ledger stops handled automatically within NPCI timelines.",
      sponsor: "Rahul Mehta",
      owner: "Priya Nair",
      teams: ["Payments", "Ops"],
      phase: "build",
      health: "at-risk",
      healthNote:
        "Build started while BRD-31 is still in review; the architecture was generated from draft v0.3.",
      startDate: "2026-08-04",
      targetDate: "2026-11-25",
      budgetUsd: 420_000,
      spentUsd: 236_000,
      tools: {
        jira: "UPI",
        repo: "acme/mandate-svc",
        cloud: "sub-payments-prod · Central India",
        confluence: "PAY",
      },
      platform: false,
    },
    {
      id: "prj-mrc",
      key: "MRC",
      programId: "pgm-pay",
      name: "Merchant services",
      objective: "Give merchants self-service refunds and settlement reports.",
      sponsor: "Rahul Mehta",
      owner: "Suresh Rao",
      teams: ["Payments", "Ops"],
      phase: "build",
      health: "on-track",
      healthNote: "Settlement report v2 in build; bulk refund export being shaped.",
      startDate: "2026-09-01",
      targetDate: "2027-01-29",
      budgetUsd: 260_000,
      spentUsd: 61_000,
      tools: {
        jira: "MRC",
        repo: "acme/merchant-reports",
        cloud: "sub-payments-prod · Central India",
        confluence: "PAY",
      },
      platform: false,
    },
    {
      id: "prj-card",
      key: "CARD",
      programId: "pgm-pay",
      name: "Card platform upgrade",
      objective: "Move card tokenisation to the network token service and refresh card statements.",
      sponsor: "Rahul Mehta",
      owner: "Vikram Joshi",
      teams: ["Cards"],
      phase: "build",
      health: "off-track",
      healthNote: "INT-18 tokenisation tests failing for 6 days; AI spend above plan.",
      startDate: "2026-07-14",
      targetDate: "2026-12-11",
      budgetUsd: 380_000,
      spentUsd: 301_000,
      tools: {
        jira: "CARD",
        repo: "acme/card-vault",
        cloud: "sub-cards-prod · Central India",
        confluence: "CARDS",
      },
      platform: false,
    },
    {
      id: "prj-kyc",
      key: "KYC",
      programId: "pgm-risk",
      name: "KYC refresh",
      objective: "Re-check merchant KYC on schedule and alert on dormant accounts.",
      sponsor: "Meera Iyer",
      owner: "Anita Rao",
      teams: ["KYC"],
      phase: "release",
      health: "on-track",
      healthNote: "Dormant account alerts at 25% rollout and healthy.",
      startDate: "2026-06-02",
      targetDate: "2026-12-04",
      budgetUsd: 310_000,
      spentUsd: 188_000,
      tools: {
        jira: "KYC",
        repo: "acme/kyc-engine",
        cloud: "sub-risk-prod · Central India",
        confluence: "RISK",
      },
      platform: false,
    },
    {
      id: "prj-sup",
      key: "SUP",
      programId: "pgm-ai",
      name: "Support automation",
      objective:
        "Answer support email faster with an agent that triages, routes and drafts replies, with people approving what matters.",
      sponsor: "Sanjay Menon",
      owner: "Kavita Rao",
      teams: ["Support", "Platform"],
      phase: "design",
      health: "at-risk",
      healthNote:
        "Go-live depends on the MCP governance platform's production gateway (MCP M4), forecast a week late.",
      startDate: "2026-10-01",
      targetDate: "2027-03-12",
      budgetUsd: 540_000,
      spentUsd: 38_000,
      tools: {
        jira: "SUP",
        repo: "acme/support-agent",
        cloud: "sub-ai-prod · Central India",
        confluence: "AICOE",
      },
      platform: false,
    },
    {
      id: "prj-mcp",
      key: "MCP",
      programId: "pgm-ai",
      name: "MCP governance platform",
      objective:
        "One governed path for every agent tool call: registered servers, agent identity, prompt-injection screening, audit and a kill switch.",
      sponsor: "Sanjay Menon",
      owner: "Neha Gupta",
      teams: ["Platform", "Security"],
      phase: "design",
      health: "on-track",
      healthNote: "BRD approved; architecture awaiting G2 security sign-off.",
      startDate: "2026-10-06",
      targetDate: "2027-02-05",
      budgetUsd: 460_000,
      spentUsd: 29_000,
      tools: {
        jira: "MCP",
        repo: "acme/mcp-gateway",
        cloud: "sub-platform-prod · Central India",
        confluence: "AICOE",
      },
      platform: true,
    },
  ],
  plans: [
    plan(
      "prj-upi",
      "1.3",
      "2026-11-25",
      "2026-12-02",
      [
        ws("ws-req", "Requirements and sign-off", "Priya Nair", "2026-08-04", "2026-10-24", 85, "late", [
          ref("brd", "BRD-31"),
        ]),
        ws(
          "ws-design",
          "Spec, design and G2 pack",
          "Anita Rao",
          "2026-09-15",
          "2026-11-04",
          70,
          "in-progress",
          [
            ref("spec", "SPEC-12"),
            ref("design", "DES-31"),
            ref("architecture", "arch-31"),
            ref("review", "rv-31"),
          ],
        ),
        ws(
          "ws-build",
          "Build: cancel API, revoke saga, UI",
          "Payments team",
          "2026-10-06",
          "2026-11-13",
          60,
          "in-progress",
          [ref("build", "lane-1")],
        ),
        ws(
          "ws-release",
          "Verify and release R-26.11",
          "Meera S.",
          "2026-11-10",
          "2026-11-25",
          0,
          "upcoming",
          [ref("release", "rel-11")],
        ),
      ],
      [
        ms("M1", "BRD-31 signed off", "2026-10-24", "late", "Priya Nair", {
          gate: "brd",
          refs: [ref("brd", "BRD-31")],
        }),
        ms("M2", "Spec approved at G1", "2026-10-28", "upcoming", "Rahul Mehta", {
          gate: "g1",
          refs: [ref("spec", "SPEC-12")],
          dependsOn: ["M1"],
        }),
        ms("M3", "Architecture and security at G2", "2026-11-04", "upcoming", "Architecture board", {
          gate: "g2",
          refs: [ref("architecture", "arch-31"), ref("review", "rv-31")],
          dependsOn: ["M2"],
        }),
        ms("M4", "Changes accepted at G3", "2026-11-13", "upcoming", "Rahul K.", {
          gate: "g3",
          dependsOn: ["M3"],
        }),
        ms("M5", "Released to all customers (G4)", "2026-11-25", "upcoming", "Meera S.", {
          gate: "g4",
          refs: [ref("release", "rel-11")],
          dependsOn: ["M4"],
        }),
      ],
    ),
    plan(
      "prj-mrc",
      "1.0",
      "2027-01-29",
      "2027-01-29",
      [
        ws("ws-reports", "Settlement report v2", "Ops team", "2026-09-01", "2026-11-20", 65, "in-progress"),
        ws("ws-refunds", "Bulk refund export", "Payments team", "2026-11-02", "2027-01-29", 5, "upcoming"),
      ],
      [
        ms("M1", "Refund export shaped (G0)", "2026-11-06", "upcoming", "Suresh Rao", { gate: "g0" }),
        ms("M2", "Settlement report v2 live", "2026-11-20", "in-progress", "Ops team", { gate: "g4" }),
        ms("M3", "Bulk refund export live", "2027-01-29", "upcoming", "Payments team", {
          gate: "g4",
          dependsOn: ["M1"],
        }),
      ],
    ),
    plan(
      "prj-card",
      "2.1",
      "2026-12-11",
      "2027-01-15",
      [
        ws("ws-token", "Network tokenisation", "Cards team", "2026-07-14", "2026-12-11", 55, "blocked"),
        ws(
          "ws-statement",
          "Statement PDF redesign",
          "Cards team",
          "2026-09-07",
          "2026-11-13",
          80,
          "in-progress",
        ),
        ws("ws-fraud", "Fraud rule tuning", "Risk analytics", "2026-11-02", "2026-12-18", 0, "upcoming"),
      ],
      [
        ms("M1", "Statement redesign accepted (G3)", "2026-11-06", "in-progress", "Vikram Joshi", {
          gate: "g3",
        }),
        ms("M2", "Tokenisation tests green", "2026-10-30", "late", "Cards team"),
        ms("M3", "Tokenisation live", "2026-12-11", "late", "Cards team", { gate: "g4", dependsOn: ["M2"] }),
      ],
    ),
    plan(
      "prj-kyc",
      "1.4",
      "2026-12-04",
      "2026-12-04",
      [
        ws("ws-dormant", "Dormant account alerts", "KYC team", "2026-06-02", "2026-11-14", 90, "in-progress"),
        ws("ws-recheck", "Merchant KYC re-check", "KYC team", "2026-10-12", "2026-12-04", 20, "in-progress"),
      ],
      [
        ms("M1", "Dormant alerts at 100%", "2026-11-14", "in-progress", "Meera S.", { gate: "g4" }),
        ms("M2", "KYC re-check spec at G1", "2026-11-03", "upcoming", "Compliance", { gate: "g1" }),
        ms("M3", "KYC re-check live", "2026-12-04", "upcoming", "KYC team", {
          gate: "g4",
          dependsOn: ["M2"],
        }),
      ],
    ),
    plan(
      "prj-sup",
      "1.1",
      "2027-03-12",
      "2027-03-26",
      [
        ws("ws-req", "Requirements and approvals", "Priya Nair", "2026-10-01", "2026-10-20", 100, "done", [
          ref("brd", "BRD-40"),
        ]),
        ws(
          "ws-arch",
          "Architecture and G2",
          "Architecture lead",
          "2026-10-20",
          "2026-11-06",
          60,
          "in-progress",
          [ref("architecture", "arch-40")],
        ),
        ws(
          "ws-build",
          "Build: intake, triage agent, console",
          "Support platform team",
          "2026-11-09",
          "2027-01-15",
          0,
          "upcoming",
          [ref("backlog", "bl-BRD-40")],
        ),
        ws(
          "ws-shadow",
          "Shadow mode and accuracy tuning",
          "Kavita Rao",
          "2027-01-04",
          "2027-02-12",
          0,
          "upcoming",
        ),
        ws(
          "ws-live",
          "Go-live and hypercare",
          "Support operations",
          "2027-02-15",
          "2027-03-12",
          0,
          "upcoming",
        ),
      ],
      [
        ms("M1", "BRD-40 approved", "2026-10-20", "done", "Priya Nair", {
          gate: "brd",
          refs: [ref("brd", "BRD-40")],
        }),
        ms("M2", "Architecture approved at G2", "2026-11-06", "in-progress", "Architecture board", {
          gate: "g2",
          refs: [ref("architecture", "arch-40")],
          dependsOn: ["M1"],
        }),
        ms("M3", "Backlog pushed to Jira", "2026-11-09", "upcoming", "Kavita Rao", {
          refs: [ref("backlog", "bl-BRD-40")],
          dependsOn: ["M2"],
        }),
        ms("M4", "Shadow mode on live mail", "2027-01-04", "upcoming", "Kavita Rao", {
          dependsOn: ["M3", "MCP:M3"],
        }),
        ms("M5", "Production go-live (G4)", "2027-02-15", "upcoming", "Sanjay Menon", {
          gate: "g4",
          dependsOn: ["M4", "MCP:M4"],
        }),
      ],
    ),
    plan(
      "prj-mcp",
      "1.0",
      "2027-02-05",
      "2027-02-12",
      [
        ws("ws-req", "Requirements and approvals", "Priya Nair", "2026-10-06", "2026-10-21", 100, "done", [
          ref("brd", "BRD-52"),
        ]),
        ws(
          "ws-arch",
          "Architecture and security review",
          "Arjun Shah",
          "2026-10-21",
          "2026-11-07",
          70,
          "in-progress",
          [ref("architecture", "arch-52")],
        ),
        ws(
          "ws-gw",
          "Gateway, policy chain and identity",
          "Platform engineering",
          "2026-11-10",
          "2026-12-19",
          0,
          "upcoming",
          [ref("backlog", "bl-BRD-52")],
        ),
        ws(
          "ws-reg",
          "Registry and onboarding portal",
          "Platform engineering",
          "2026-11-24",
          "2027-01-22",
          0,
          "upcoming",
        ),
        ws(
          "ws-prod",
          "Production, DR test and first consumers",
          "Platform engineering",
          "2027-01-11",
          "2027-02-05",
          0,
          "upcoming",
        ),
      ],
      [
        ms("M1", "BRD-52 approved", "2026-10-21", "done", "Priya Nair", {
          gate: "brd",
          refs: [ref("brd", "BRD-52")],
        }),
        ms("M2", "Architecture and security at G2", "2026-11-07", "in-progress", "Arjun Shah", {
          gate: "g2",
          refs: [ref("architecture", "arch-52")],
          dependsOn: ["M1"],
        }),
        ms("M3", "Gateway live in pre-production", "2026-12-19", "upcoming", "Platform engineering", {
          dependsOn: ["M2"],
        }),
        ms("M4", "Production gateway, DR failover tested", "2027-02-05", "upcoming", "Neha Gupta", {
          gate: "g4",
          dependsOn: ["M3"],
        }),
      ],
    ),
  ],
  links: [
    link(
      "lk-1",
      ref("architecture", "arch-31"),
      "derives-from",
      ref("brd", "BRD-31"),
      "0.3",
      "Generated from the draft in review",
    ),
    link(
      "lk-2",
      ref("architecture", "arch-40"),
      "derives-from",
      ref("brd", "BRD-40"),
      "1.0",
      "Generated from the approved BRD",
    ),
    link(
      "lk-3",
      ref("architecture", "arch-52"),
      "derives-from",
      ref("brd", "BRD-52"),
      "1.0",
      "Generated from the approved BRD",
    ),
    link(
      "lk-4",
      ref("architecture", "arch-40"),
      "depends-on",
      ref("architecture", "arch-52"),
      null,
      "Every ServiceNow and CRM tool call goes through the MCP gateway (BR-07, BR-11)",
    ),
    link(
      "lk-5",
      ref("project", "prj-sup"),
      "depends-on",
      ref("project", "prj-mcp"),
      null,
      "Shadow mode needs the gateway in pre-production; go-live needs it in production",
    ),
    link(
      "lk-6",
      ref("spec", "SPEC-12"),
      "derives-from",
      ref("brd", "BRD-31"),
      "0.3",
      "Spec drafted from the BRD in review",
    ),
    link(
      "lk-7",
      ref("design", "DES-31"),
      "implements",
      ref("spec", "SPEC-12"),
      null,
      "Design options for the cancel flow",
    ),
    link(
      "lk-8",
      ref("review", "rv-31"),
      "traces-to",
      ref("architecture", "arch-31"),
      null,
      "G2 pack reviews this architecture",
    ),
  ],
};

/* ── Northwind Bank ───────────────────────────────────────────────────────────────────────────── */

export const northwindWorkMap: Record<string, string> = {
  "INT-199": "prj-iso",
  "INT-201": "prj-iso",
  "INT-185": "prj-iso",
  "INT-208": "prj-onb",
  "INT-212": "prj-onb",
  "INT-190": "prj-cbs",
};

export const northwindProjects: TenantProjects = {
  programs: [
    {
      id: "pgm-ptx",
      key: "PTX",
      name: "Payments transformation",
      objective: "Meet the ISO 20022 deadline and retire the legacy SWIFT gateway.",
      sponsor: "Omar Haddad · Head of payments",
      owner: "Layla Hassan",
      status: "active",
      health: "at-risk",
      horizon: "2026–27",
      budgetUsd: 2_400_000,
      outcomes: [{ metric: "Cross-border payments sent as native pacs.008", baseline: "0%", target: "100%" }],
    },
    {
      id: "pgm-core",
      key: "CORE",
      name: "Core and onboarding",
      objective: "Shorten corporate onboarding and modernise interest calculation.",
      sponsor: "Fatima Al Mansoori · COO",
      owner: "Yusuf Karim",
      status: "active",
      health: "on-track",
      horizon: "2027",
      budgetUsd: 1_500_000,
      outcomes: [{ metric: "Corporate onboarding time", baseline: "18 days", target: "5 days" }],
    },
  ],
  projects: [
    {
      id: "prj-iso",
      key: "ISO",
      programId: "pgm-ptx",
      name: "ISO 20022 migration",
      objective: "Send and receive cross-border payments as native ISO 20022 messages before the deadline.",
      sponsor: "Omar Haddad",
      owner: "Layla Hassan",
      teams: ["Payments hub"],
      phase: "design",
      health: "at-risk",
      healthNote: "Architecture brief not confirmed yet; G1 for INT-199 waiting.",
      startDate: "2026-06-01",
      targetDate: "2027-03-31",
      budgetUsd: 1_600_000,
      spentUsd: 540_000,
      tools: { jira: null, repo: "northwind/payments-hub", cloud: "UAE North", confluence: "PHUB" },
      platform: false,
    },
    {
      id: "prj-onb",
      key: "ONB",
      programId: "pgm-core",
      name: "Corporate onboarding",
      objective: "Cut corporate onboarding time and make sanctions screening resilient.",
      sponsor: "Fatima Al Mansoori",
      owner: "Yusuf Karim",
      teams: ["Onboarding"],
      phase: "requirements",
      health: "on-track",
      healthNote: "Shaping the SLA work; sanctions retries in spec.",
      startDate: "2026-10-01",
      targetDate: "2027-04-30",
      budgetUsd: 700_000,
      spentUsd: 42_000,
      tools: { jira: null, repo: "northwind/onboarding", cloud: "UAE North", confluence: "ONB" },
      platform: false,
    },
    {
      id: "prj-cbs",
      key: "CBS",
      programId: "pgm-core",
      name: "Core banking renewal",
      objective: "Rewrite interest calculation off the legacy core.",
      sponsor: "Fatima Al Mansoori",
      owner: "Hamza Qureshi",
      teams: ["Core banking"],
      phase: "build",
      health: "at-risk",
      healthNote: "Legacy-mode build is slow; AI spend above plan.",
      startDate: "2026-05-04",
      targetDate: "2027-02-26",
      budgetUsd: 800_000,
      spentUsd: 520_000,
      tools: { jira: null, repo: "northwind/core-interest", cloud: "On-prem DC", confluence: "CORE" },
      platform: false,
    },
  ],
  plans: [
    plan(
      "prj-iso",
      "2.0",
      "2027-03-31",
      "2027-04-16",
      [
        ws("ws-req", "Requirements (BRD-199)", "Layla Hassan", "2026-06-01", "2026-10-15", 100, "done", [
          ref("brd", "BRD-199"),
        ]),
        ws(
          "ws-arch",
          "Architecture and G2",
          "Architecture team",
          "2026-10-15",
          "2026-11-20",
          10,
          "in-progress",
          [ref("architecture", "arch-199")],
        ),
        ws(
          "ws-build",
          "Translation layer and routing",
          "Payments hub",
          "2026-11-23",
          "2027-02-26",
          0,
          "upcoming",
        ),
        ws(
          "ws-swift",
          "SWIFT gateway retirement",
          "Payments hub",
          "2026-09-01",
          "2026-11-07",
          90,
          "in-progress",
        ),
      ],
      [
        ms("M1", "BRD-199 approved", "2026-10-15", "done", "Omar Haddad", {
          gate: "brd",
          refs: [ref("brd", "BRD-199")],
        }),
        ms("M2", "Spec approved at G1", "2026-10-30", "upcoming", "Layla Hassan", { gate: "g1" }),
        ms("M3", "Architecture at G2", "2026-11-20", "upcoming", "Architecture team", {
          gate: "g2",
          refs: [ref("architecture", "arch-199")],
          dependsOn: ["M2"],
        }),
        ms("M4", "Legacy SWIFT gateway retired", "2026-11-07", "in-progress", "Payments hub", { gate: "g4" }),
        ms("M5", "Native pacs.008 live", "2027-03-31", "upcoming", "Omar Haddad", {
          gate: "g4",
          dependsOn: ["M3"],
        }),
      ],
    ),
    plan(
      "prj-onb",
      "1.0",
      "2027-04-30",
      "2027-04-30",
      [
        ws(
          "ws-shape",
          "Onboarding SLA discovery",
          "Yusuf Karim",
          "2026-10-01",
          "2026-11-14",
          30,
          "in-progress",
        ),
        ws(
          "ws-sanctions",
          "Sanctions screening retries",
          "Onboarding",
          "2026-10-15",
          "2026-12-18",
          15,
          "in-progress",
        ),
      ],
      [
        ms("M1", "SLA shaped (G0)", "2026-11-14", "upcoming", "Yusuf Karim", { gate: "g0" }),
        ms("M2", "Sanctions retries live", "2026-12-18", "upcoming", "Onboarding", { gate: "g4" }),
      ],
    ),
    plan(
      "prj-cbs",
      "1.2",
      "2027-02-26",
      "2027-03-19",
      [
        ws(
          "ws-interest",
          "Interest calculation rewrite",
          "Core banking",
          "2026-05-04",
          "2027-02-26",
          45,
          "in-progress",
        ),
      ],
      [
        ms("M1", "Parallel run starts", "2026-12-07", "upcoming", "Hamza Qureshi"),
        ms("M2", "Cut-over (G4)", "2027-02-26", "upcoming", "Fatima Al Mansoori", {
          gate: "g4",
          dependsOn: ["M1"],
        }),
      ],
    ),
  ],
  links: [
    link(
      "lk-1",
      ref("architecture", "arch-199"),
      "derives-from",
      ref("brd", "BRD-199"),
      "1.0",
      "Brief drafted from the approved BRD",
    ),
  ],
};

/* ── Fabrikam Retail ──────────────────────────────────────────────────────────────────────────── */

export const fabrikamWorkMap: Record<string, string> = { "INT-12": "prj-loy", "INT-14": "prj-chk" };

export const fabrikamProjects: TenantProjects = {
  programs: [
    {
      id: "pgm-dig",
      key: "DIG",
      name: "Digital commerce",
      objective: "Grow repeat purchases through loyalty and a faster checkout.",
      sponsor: "Emma Walsh · Chief digital officer",
      owner: "Tom Becker",
      status: "active",
      health: "on-track",
      horizon: "2027",
      budgetUsd: 600_000,
      outcomes: [{ metric: "Repeat purchase rate", baseline: "31%", target: "38%" }],
    },
  ],
  projects: [
    {
      id: "prj-loy",
      key: "LOY",
      programId: "pgm-dig",
      name: "Loyalty 2.0",
      objective: "Expire unused points fairly and remind shoppers before they lapse.",
      sponsor: "Emma Walsh",
      owner: "Tom Becker",
      teams: ["Loyalty"],
      phase: "requirements",
      health: "on-track",
      healthNote: "BRD-12 drafting; architecture generated from draft v0.2.",
      startDate: "2026-10-05",
      targetDate: "2027-01-29",
      budgetUsd: 180_000,
      spentUsd: 12_000,
      tools: { jira: "LOY", repo: "fabrikam/loyalty", cloud: "West Europe", confluence: null },
      platform: false,
    },
    {
      id: "prj-chk",
      key: "CHK",
      programId: "pgm-dig",
      name: "Checkout",
      objective: "Basket-level discounts through one API.",
      sponsor: "Emma Walsh",
      owner: "Sara Lind",
      teams: ["Checkout"],
      phase: "build",
      health: "on-track",
      healthNote: "Basket discount API in build.",
      startDate: "2026-09-14",
      targetDate: "2026-12-11",
      budgetUsd: 120_000,
      spentUsd: 44_000,
      tools: { jira: "CHK", repo: "fabrikam/checkout", cloud: "West Europe", confluence: null },
      platform: false,
    },
  ],
  plans: [
    plan(
      "prj-loy",
      "1.0",
      "2027-01-29",
      "2027-01-29",
      [
        ws("ws-req", "Requirements (BRD-12)", "Tom Becker", "2026-10-05", "2026-11-06", 40, "in-progress", [
          ref("brd", "BRD-12"),
        ]),
        ws("ws-build", "Expiry worker and reminders", "Loyalty", "2026-11-16", "2027-01-15", 0, "upcoming", [
          ref("architecture", "arch-12"),
        ]),
      ],
      [
        ms("M1", "BRD-12 approved", "2026-11-06", "upcoming", "Emma Walsh", {
          gate: "brd",
          refs: [ref("brd", "BRD-12")],
        }),
        ms("M2", "Expiry live", "2027-01-29", "upcoming", "Tom Becker", { gate: "g4", dependsOn: ["M1"] }),
      ],
    ),
    plan(
      "prj-chk",
      "1.0",
      "2026-12-11",
      "2026-12-11",
      [ws("ws-api", "Basket discount API", "Checkout", "2026-09-14", "2026-12-11", 55, "in-progress")],
      [ms("M1", "Discount API live", "2026-12-11", "upcoming", "Sara Lind", { gate: "g4" })],
    ),
  ],
  links: [
    link(
      "lk-1",
      ref("architecture", "arch-12"),
      "derives-from",
      ref("brd", "BRD-12"),
      "0.2",
      "Generated from the draft BRD",
    ),
  ],
};
