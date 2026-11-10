import type { Tenant } from "@throughline/contracts";
import { fabrikamSubject, seedArchitecture } from "../architect";
import { fabrikamBrds } from "../ba";
import { fabrikamBrdContent } from "../ba/otherBrds";
import { buildTestPlans, fabrikamTestProfiles } from "../qa/seed";
import { fabrikamSecurity } from "../security/seed";
import { agent, integrations, kpi, stage, work } from "./builders";
import { acmeModules, retheme } from "./modules";
import { fabrikamProjects, fabrikamWorkMap, placeWorkItems } from "./projects";
import type { TenantSeed } from "./types";

export const fabrikamTenant: Tenant = {
  id: "t_fab4d0",
  slug: "fabrikam",
  name: "Fabrikam Retail",
  plan: "team",
  region: "us-virginia",
  isolation: "pooled",
  encryption: "platform-key",
  identityProvider: "Google Workspace",
  features: ["shape", "portfolio", "control-room"],
};

const fabrikamBase: Omit<TenantSeed, "testPlans" | "assistant"> = {
  controlRoom: {
    stages: [
      stage("shape", 2, "briefs", "Idle", false, "Rough input turned into decisions.", [
        ["INT-12", "Loyalty points expiry", 100, "Decided · small option"],
      ]),
      stage("brd", 1, "BRDs", "BA agent drafting", true, "Business requirements, checked and signed.", [
        ["BRD-12", "Loyalty points expiry", 60, "Draft · 5 quality warnings"],
      ]),
      stage("spec", 1, "specs", "1 agent drafting", true, "Requirements and acceptance checks.", [
        ["SPEC-4", "Points expiry rules", 60, "Drafting"],
      ]),
      stage("design", 0, "designs", "Idle", false, "Options and threat models.", []),
      stage(
        "review",
        0,
        "packs",
        "Idle",
        false,
        "Architecture and security artifact pack, signed at G2.",
        [],
      ),
      stage("build", 3, "tasks", "1 agent coding", true, "Agent work in isolated worktrees.", [
        ["TSK-31", "Basket discount API", 50, "builder-1 · coding"],
      ]),
      stage("verify", 1, "changes", "Idle", false, "Changes checked against specs.", [
        ["PR-88", "Gift card balance", 100, "Merged"],
      ]),
      stage("release", 0, "releases", "Idle", false, "Progressive rollout.", []),
      stage("operate", 4, "services", "SRE agent watching", true, "Telemetry watched by the SRE agent.", [
        ["SVC-2", "checkout-api", 20, "Healthy"],
      ]),
      stage("learn", 0, "rules", "Idle", false, "Incidents become rules.", []),
    ],
    agents: [
      agent("SP", "spec-agent", "Points expiry rules", "sonnet", 60),
      agent("B1", "builder-1", "Basket discount API", "sonnet", 50),
      agent("SR", "sre-agent", "Watching checkout-api", "haiku", 20),
    ],
    decisions: [],
    kpis: [
      kpi(
        "cost-pr",
        "Cost per merged PR",
        "$1.90",
        "▼ 4%",
        "good",
        "Pilot team",
        [2.2, 2.1, 2.1, 2, 2, 1.95, 1.9, 1.9, 1.9],
      ),
      kpi(
        "lead",
        "Lead time to production",
        "2.2 d",
        "▼ 0.3 d",
        "good",
        "DORA · median",
        [2.8, 2.7, 2.6, 2.6, 2.5, 2.4, 2.3, 2.3, 2.2],
      ),
    ],
  },
  workItems: {
    teams: ["Loyalty", "Checkout"],
    items: placeWorkItems(
      [
        work(
          "INT-12",
          "Loyalty points expiry",
          "Loyalty",
          "spec",
          1,
          ["agent", "spec-agent · drafting"],
          2,
          0.6,
        ),
        work(
          "INT-14",
          "Basket discount API",
          "Checkout",
          "build",
          1,
          ["agent", "builder-1 · coding"],
          3.5,
          1.2,
        ),
      ],
      fabrikamWorkMap,
    ),
  },
  integrations: integrations(
    { github: "connected", jira: "connected", slack: "connected" },
    { github: "GitHub App · 3 repos", jira: "API token · pilot", slack: "App · 1 channel" },
  ),
  ...fabrikamSecurity,
  modules: retheme(acmeModules, [
    ["UPI AutoPay mandate cancellation", "Loyalty points expiry"],
    ["UPI AutoPay cancellation", "Loyalty points expiry"],
    ["Ledger idempotency keys", "Basket discount API"],
    ["DPDP Act 2023 / NPCI", "CCPA"],
    ["NPCI AutoPay rules", "consumer protection rules"],
    ["India (Mumbai)", "US (Virginia)"],
    ["INT-31", "INT-12"],
    ["INT-29", "INT-14"],
    ["SPEC-12", "SPEC-4"],
    ["SPEC-13", "SPEC-5"],
    ["rv-31", "rv-12"],
    ["rv-29", "rv-14"],
    ["payments-api", "checkout-api"],
    ["mandate-svc", "loyalty-svc"],
    ["ledger-svc", "points-ledger"],
    ["R-26.11", "R-3.2"],
    ["INC-231", "INC-7"],
    ["Mandate", "Points"],
    ["mandate", "points"],
    ["PSP", "loyalty provider"],
    ["UPI", "Loyalty"],
    ["Hindi", "Spanish"],
    ["DPDP", "CCPA"],
    ["Priya N.", "Sam R."],
    ["Anita R.", "Alex T."],
    ["Arjun S.", "Jo P."],
    ["Rahul K.", "Riya D."],
    ["Meera S.", "Chris L."],
  ]),
  architectures: [
    seedArchitecture(fabrikamTenant, fabrikamSubject, true, {
      projectId: "prj-loy",
      brd: fabrikamBrdContent,
    }),
  ],
  brds: fabrikamBrds(),
  ...fabrikamProjects,
};

export const fabrikamSeed: TenantSeed = {
  ...fabrikamBase,
  testPlans: buildTestPlans(fabrikamBase, fabrikamTestProfiles),
  assistant: { conversations: [], seq: 0 },
};
