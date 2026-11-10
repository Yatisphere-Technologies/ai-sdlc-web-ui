import type {
  AgentGovernance,
  AgentIdentity,
  AgentPolicy,
  AuditEvent,
  KeyManagement,
  Member,
  ScimSettings,
  SecurityControl,
  SsoSettings,
} from "@throughline/contracts";
import { chainAppend } from "./chain";
import { workspaceControls } from "./controls";

/* ── Store shapes ────────────────────────────────────────────────────────────────────────────── */

export type SecurityStore = { controls: SecurityControl[]; keys: KeyManagement; ip: string };
export type MembersStore = {
  items: Member[];
  review: { lastAt: string | null; by: string | null; everyDays: number };
  seatsTotal: number;
};
export type IdentityStore = { sso: SsoSettings; scim: ScimSettings };
/** `killed` remembers which agents the kill switch suspended, so releasing it restores only those. */
export type AgentStore = AgentGovernance & { killed: string[] };
export type SecurityBundle = {
  security: SecurityStore;
  members: MembersStore;
  identity: IdentityStore;
  agentGov: AgentStore;
  audit: AuditEvent[];
};

/** The signed-in mock user; their member record in each workspace decides what they may do. */
export const YOU = "u_priya";

/* ── Builders ────────────────────────────────────────────────────────────────────────────────── */

type M = Partial<Member> & Pick<Member, "id" | "name" | "email" | "roles">;
const member = (m: M): Member => ({
  grants: [],
  status: "active",
  source: "scim",
  mfa: true,
  breakGlass: false,
  groups: [],
  lastActiveAt: "2026-10-25T09:12:00Z",
  addedAt: "2026-03-02T10:00:00Z",
  ...m,
});

const key = (
  mode: KeyManagement["mode"],
  provider: string,
  keyRef: string,
  rotatedAt: string,
  rotationDays: number,
  older: string[],
): KeyManagement => ({
  mode,
  provider,
  keyRef,
  status: "active",
  rotationDays,
  rotatedAt,
  revokedAt: null,
  versions: [
    {
      version: "v4",
      createdAt: rotatedAt,
      by: "Scheduled rotation",
      reason: "Rotation policy",
      status: "active",
    },
    ...older.map((at, i) => ({
      version: `v${3 - i}`,
      createdAt: at,
      by: i === older.length - 1 ? "Workspace setup" : "Scheduled rotation",
      reason: i === older.length - 1 ? "Initial key" : "Rotation policy",
      status: "retired" as const,
    })),
  ],
});

type A = Partial<AgentIdentity> &
  Pick<AgentIdentity, "id" | "code" | "name" | "purpose" | "scopes" | "tools">;
function agents(idp: (name: string) => string, owner: Record<string, string>, list: A[]): AgentIdentity[] {
  return list.map((a) => ({
    identity: idp(a.name),
    credential: { type: "federated", rotatedAt: "2026-10-01T00:00:00Z" },
    owner: owner[a.id] ?? owner.default ?? "Workspace admin",
    status: "active",
    autonomy: "approve",
    dataAccess: "confidential",
    model: "opus",
    budgetUsd: 400,
    spentUsd: 120,
    actions30d: 300,
    denied30d: 2,
    lastActionAt: "2026-10-25T10:40:00Z",
    ...a,
  }));
}

/** The platform's standard agents, each with its own identity and least-privilege scopes. */
const STANDARD_AGENTS: A[] = [
  {
    id: "ba-agent",
    code: "BA",
    name: "ba-agent",
    purpose: "Drafts BRDs from interviews and documents; proposes the backlog",
    scopes: ["brd:write-draft", "confluence:read", "jira:read", "sharepoint:read"],
    tools: ["confluence-mcp", "jira-mcp", "m365-files-mcp"],
    autonomy: "suggest",
    spentUsd: 212,
    actions30d: 418,
  },
  {
    id: "spec-agent",
    code: "SP",
    name: "spec-agent",
    purpose: "Turns approved BRDs into specs and acceptance checks",
    scopes: ["spec:write-draft", "brd:read", "jira:write"],
    tools: ["jira-mcp", "confluence-mcp"],
    autonomy: "suggest",
    spentUsd: 96,
    actions30d: 160,
  },
  {
    id: "architect-agent",
    code: "AR",
    name: "architect-agent",
    purpose: "Generates diagrams, decisions and the design document",
    scopes: ["architecture:write-draft", "brd:read", "cloud:read-inventory"],
    tools: ["azure-docs-mcp", "drawio-export"],
    autonomy: "suggest",
    spentUsd: 141,
    actions30d: 92,
  },
  {
    id: "qa-agent",
    code: "QA",
    name: "qa-agent",
    purpose: "Drafts test plans and cases; reads CI results",
    scopes: ["testplan:write-draft", "backlog:read", "ci:read-results", "testtool:write"],
    tools: ["jira-mcp", "xray-api", "github-actions-mcp"],
    autonomy: "approve",
    spentUsd: 64,
    actions30d: 205,
  },
  {
    id: "builder-1",
    code: "B1",
    name: "builder-1",
    purpose: "Implements tasks on a feature branch in a sandbox",
    scopes: ["repo:write-branch", "repo:open-pr", "ci:run"],
    tools: ["github-mcp", "sandbox-shell", "package-registry"],
    autonomy: "act",
    model: "sonnet",
    spentUsd: 318,
    actions30d: 1840,
    denied30d: 7,
  },
  {
    id: "builder-2",
    code: "B2",
    name: "builder-2",
    purpose: "Implements tasks on a feature branch in a sandbox",
    scopes: ["repo:write-branch", "repo:open-pr", "ci:run"],
    tools: ["github-mcp", "sandbox-shell", "package-registry", "playwright"],
    autonomy: "act",
    model: "sonnet",
    spentUsd: 287,
    actions30d: 1512,
    denied30d: 4,
  },
  {
    id: "reviewer",
    code: "RV",
    name: "reviewer",
    purpose: "Checks every change against its spec; first key at G3",
    scopes: ["repo:read", "pr:comment", "pr:sign-key-1"],
    tools: ["github-mcp", "sonar-api"],
    autonomy: "act",
    spentUsd: 233,
    actions30d: 640,
  },
  {
    id: "security-agent",
    code: "SC",
    name: "security-agent",
    purpose: "Threat models, SAST, dependency and secret scans",
    scopes: ["repo:read", "pr:comment", "findings:write"],
    tools: ["github-mcp", "codeql", "dependency-scan"],
    autonomy: "act",
    dataAccess: "restricted",
    spentUsd: 88,
    actions30d: 410,
  },
  {
    id: "release-agent",
    code: "RL",
    name: "release-agent",
    purpose: "Runs progressive rollouts; production only after G4",
    scopes: ["deploy:staging", "deploy:prod", "flags:write"],
    tools: ["azure-devops-mcp", "feature-flags"],
    autonomy: "approve",
    model: "sonnet",
    spentUsd: 41,
    actions30d: 77,
  },
  {
    id: "sre-agent",
    code: "SR",
    name: "sre-agent",
    purpose: "Diagnoses incidents from telemetry; proposes fixes",
    scopes: ["telemetry:read", "incident:write", "runbook:execute"],
    tools: ["azure-monitor-mcp", "pagerduty-mcp", "runbooks"],
    autonomy: "approve",
    model: "sonnet",
    spentUsd: 152,
    actions30d: 266,
  },
  {
    id: "explorer",
    code: "EX",
    name: "explorer",
    purpose: "Answers Ask questions across connected tools (read only)",
    scopes: ["jira:read", "confluence:read", "repo:read"],
    tools: ["jira-mcp", "confluence-mcp", "github-mcp"],
    autonomy: "suggest",
    model: "haiku",
    credential: { type: "secret", rotatedAt: "2026-05-04T00:00:00Z" },
    spentUsd: 22,
    budgetUsd: 100,
    actions30d: 930,
    denied30d: 31,
  },
];

function policies(off: string[] = [], hits: Record<string, number> = {}): AgentPolicy[] {
  const list: Omit<AgentPolicy, "enabled" | "hits30d">[] = [
    {
      id: "prod-approval",
      name: "Production changes need a person",
      description:
        "Deploys, flag flips and runbooks in production wait for a human approval (G4 or incident).",
      category: "release",
      enforcement: "approve",
      frameworks: ["ISO 27001 A.8.32"],
    },
    {
      id: "two-person",
      name: "Two keys on high-risk changes",
      description: "Tier-3 changes need the reviewer agent and a tech lead before merge.",
      category: "code",
      enforcement: "approve",
      frameworks: ["ISO 27001 A.8.32", "SOC 2 CC8.1"],
    },
    {
      id: "no-secrets",
      name: "No secrets in code or prompts",
      description: "Commits, PR text and prompts carrying keys or tokens are blocked.",
      category: "code",
      enforcement: "block",
      frameworks: ["ISO 27001 A.8.12"],
    },
    {
      id: "no-force-push",
      name: "No force-push or history rewrite",
      description: "Agents can only add commits on their own branches.",
      category: "code",
      enforcement: "block",
      frameworks: ["ISO 27001 A.8.4"],
    },
    {
      id: "deps",
      name: "New dependencies need a licence and CVE check",
      description: "Packages outside the approved list wait for the security agent's report.",
      category: "code",
      enforcement: "approve",
      frameworks: ["ISO 27001 A.8.28"],
    },
    {
      id: "redact",
      name: "Restricted data only after redaction",
      description: "Restricted fields reach a model only once the redaction step has run.",
      category: "data",
      enforcement: "block",
      frameworks: ["ISO 27001 A.8.11"],
    },
    {
      id: "project-scope",
      name: "Agents stay inside their project",
      description: "Repos, documents and tickets of other projects are invisible to an agent.",
      category: "data",
      enforcement: "block",
      frameworks: ["ISO 27001 A.5.15"],
    },
    {
      id: "mcp-registry",
      name: "Only registered MCP servers",
      description: "Tool calls go through the gateway to servers in the MCP registry, nowhere else.",
      category: "tools",
      enforcement: "block",
      frameworks: ["ISO 27001 A.5.19"],
    },
    {
      id: "egress",
      name: "No outbound network beyond allowed tools",
      description: "Sandboxes have no internet; package installs go through the registry mirror.",
      category: "tools",
      enforcement: "block",
      frameworks: ["ISO 27001 A.8.22"],
    },
    {
      id: "budget",
      name: "Stop an agent at its monthly budget",
      description: "At 80% the owner is told; at 100% the agent pauses until raised.",
      category: "spend",
      enforcement: "block",
      frameworks: [],
    },
  ];
  return list.map((p) => ({ ...p, enabled: !off.includes(p.id), hits30d: hits[p.id] ?? 0 }));
}

type Ev = [
  at: string,
  actor: string,
  category: AuditEvent["category"],
  action: string,
  target: string,
  detail: string,
  outcome?: AuditEvent["outcome"],
  ip?: string | null,
];

/** Builds the seeded audit chain. Actors: "h:Name", "a:agent-id" or "s:component". */
function audit(events: Ev[], defaultIp: string): AuditEvent[] {
  const chain: AuditEvent[] = [];
  for (const [at, who, category, action, target, detail, outcome = "success", ip] of [...events].sort(
    (a, b) => a[0].localeCompare(b[0]),
  )) {
    const [t, name = ""] = who.split(":");
    const type = t === "a" ? "agent" : t === "s" ? "system" : "human";
    chainAppend(chain, {
      at,
      actor: { type, id: type === "human" ? name.toLowerCase().replaceAll(" ", ".") : name, name },
      category,
      action,
      target,
      outcome,
      ip: ip === undefined ? (type === "human" ? defaultIp : null) : ip,
      detail,
    });
  }
  return chain;
}

/* ── Acme Payments ───────────────────────────────────────────────────────────────────────────── */

const acmeIdp = (n: string) => `Entra Agent ID · ${n}@acmepay.example`;

export const acmeSecurity: SecurityBundle = {
  security: {
    ip: "203.0.113.24",
    controls: workspaceControls({
      off: ["ip"],
      idInfo: "Entra ID Conditional Access",
      ip: [
        { cidr: "203.0.113.0/24", label: "Mumbai office" },
        { cidr: "198.51.100.16/28", label: "Zscaler egress" },
        { cidr: "192.0.2.0/26", label: "Pune office" },
      ],
      siem: { kind: "siem", target: "sentinel", endpoint: "law-acme-sec-in" },
    }),
    keys: key(
      "customer-key",
      "Azure Key Vault Managed HSM · Central India",
      "kv-acme-in/tl-cmk",
      "2026-09-13T04:00:00Z",
      90,
      ["2026-06-15T04:00:00Z", "2026-03-17T04:00:00Z", "2025-12-17T04:00:00Z"],
    ),
  },
  members: {
    seatsTotal: 25,
    review: { lastAt: "2026-07-08T11:00:00Z", by: "Priya Nair", everyDays: 90 },
    items: [
      member({
        id: YOU,
        name: "Priya Nair",
        email: "priya.nair@example.com",
        roles: ["product-owner", "tenant-admin"],
        grants: ["gate.approve.g2", "architecture.edit"],
        source: "invite",
        lastActiveAt: "2026-10-26T05:40:00Z",
        addedAt: "2025-11-04T09:00:00Z",
      }),
      member({
        id: "u_rahul",
        name: "Rahul Mehta",
        email: "rahul.mehta@acmepay.example",
        roles: ["product-owner"],
        groups: ["TL-Product-Owners"],
      }),
      member({
        id: "u_kavita",
        name: "Kavita Rao",
        email: "kavita.rao@acmepay.example",
        roles: ["product-owner"],
        groups: ["TL-Product-Owners"],
      }),
      member({
        id: "u_neha",
        name: "Neha Gupta",
        email: "neha.gupta@acmepay.example",
        roles: ["product-owner", "tenant-admin"],
        groups: ["TL-Product-Owners", "TL-Admins"],
      }),
      member({
        id: "u_vikram",
        name: "Vikram Joshi",
        email: "vikram.joshi@acmepay.example",
        roles: ["architect"],
        groups: ["TL-Architects"],
      }),
      member({
        id: "u_anita",
        name: "Anita Rao",
        email: "anita.rao@acmepay.example",
        roles: ["product-owner"],
        groups: ["TL-Product-Owners"],
      }),
      member({
        id: "u_deepa",
        name: "Deepa Krishnan",
        email: "deepa.krishnan@acmepay.example",
        roles: ["tech-lead"],
        groups: ["TL-Engineering-Leads"],
      }),
      member({
        id: "u_anand",
        name: "Anand Pillai",
        email: "anand.pillai@acmepay.example",
        roles: ["tech-lead"],
        groups: ["TL-Engineering-Leads"],
      }),
      member({
        id: "u_sunita",
        name: "Sunita Iyer",
        email: "sunita.iyer@acmepay.example",
        roles: ["engineer"],
        grants: ["review.security.signoff", "audit.read"],
        groups: ["TL-Engineers", "Sec-Reviewers"],
      }),
      member({
        id: "u_arjun",
        name: "Arjun Das",
        email: "arjun.das@acmepay.example",
        roles: ["release-manager"],
        groups: ["TL-Release"],
      }),
      member({
        id: "u_suresh",
        name: "Suresh Rao",
        email: "suresh.rao@acmepay.example",
        roles: ["engineer"],
        groups: ["TL-Engineers"],
      }),
      member({
        id: "u_karan",
        name: "Karan Malhotra",
        email: "karan.malhotra@acmepay.example",
        roles: ["engineer"],
        groups: ["TL-Engineers"],
        mfa: false,
        lastActiveAt: "2026-10-22T13:05:00Z",
      }),
      member({
        id: "u_rohit",
        name: "Rohit Verma",
        email: "rohit.verma@vendor.example",
        roles: ["engineer"],
        source: "invite",
        lastActiveAt: "2026-06-30T16:20:00Z",
        addedAt: "2026-02-10T10:00:00Z",
      }),
      member({
        id: "u_farah",
        name: "Farah Khan",
        email: "farah.khan@acmepay.example",
        roles: ["engineer"],
        status: "invited",
        source: "invite",
        mfa: false,
        lastActiveAt: null,
        addedAt: "2026-10-23T08:30:00Z",
      }),
      member({
        id: "u_breakglass",
        name: "Break-glass admin",
        email: "tl-breakglass@acmepay.example",
        roles: ["tenant-admin"],
        source: "invite",
        breakGlass: true,
        lastActiveAt: "2026-08-14T07:00:00Z",
        addedAt: "2025-11-04T09:00:00Z",
      }),
    ],
  },
  identity: {
    sso: {
      protocol: "oidc",
      provider: "Microsoft Entra ID",
      issuer: "https://login.microsoftonline.com/7c1e…-acme/v2.0",
      clientId: "3f6a9d2e-throughline-acme",
      domains: [
        {
          domain: "acmepay.example",
          verified: true,
          record: "tl-verify=acme-7f2c91",
          addedAt: "2025-11-04T09:10:00Z",
        },
        {
          domain: "acme-ops.example",
          verified: false,
          record: "tl-verify=acme-0b44e3",
          addedAt: "2026-10-20T12:00:00Z",
        },
      ],
      enforced: true,
      jit: false,
      defaultRole: "viewer",
      lastLoginAt: "2026-10-26T05:40:00Z",
    },
    scim: {
      enabled: true,
      endpoint: "https://api.throughline.example/scim/v2/t_acme7f",
      token: { last4: "9QxT", createdAt: "2026-05-02T10:00:00Z", expiresAt: "2026-11-15T10:00:00Z" },
      lastSyncAt: "2026-10-26T05:30:00Z",
      users: 12,
      groups: 7,
      mappings: [
        { group: "TL-Admins", roles: ["tenant-admin"] },
        { group: "TL-Product-Owners", roles: ["product-owner"] },
        { group: "TL-Architects", roles: ["architect"] },
        { group: "TL-Engineering-Leads", roles: ["tech-lead"] },
        { group: "TL-Release", roles: ["release-manager"] },
        { group: "TL-Engineers", roles: ["engineer"] },
      ],
      log: [
        {
          at: "2026-10-26T05:30:00Z",
          level: "info",
          message: "Sync complete: 0 created, 1 updated, 0 removed",
        },
        {
          at: "2026-10-22T13:00:00Z",
          level: "warn",
          message: "Karan Malhotra has no MFA method registered in Entra ID",
        },
        {
          at: "2026-10-18T09:15:00Z",
          level: "info",
          message: "Removed vishal.k@acmepay.example (left the company)",
        },
      ],
    },
  },
  agentGov: {
    killSwitch: { engaged: false, at: null, by: null },
    killed: [],
    policies: policies([], {
      "prod-approval": 6,
      "two-person": 4,
      "no-secrets": 3,
      deps: 9,
      "mcp-registry": 2,
      egress: 14,
      redact: 21,
      "project-scope": 5,
      budget: 1,
    }),
    agents: agents(
      acmeIdp,
      {
        default: "Neha Gupta",
        "release-agent": "Arjun Das",
        "sre-agent": "Arjun Das",
        "qa-agent": "Deepa Krishnan",
        "security-agent": "Sunita Iyer",
      },
      [
        ...STANDARD_AGENTS.map((a) => (a.id === "explorer" ? { ...a, spentUsd: 104, budgetUsd: 100 } : a)),
        {
          id: "design-agent",
          code: "DS",
          name: "design-agent",
          purpose: "Compares design options for review",
          scopes: ["design:write-draft", "spec:read"],
          tools: ["figma-mcp"],
          autonomy: "suggest",
          spentUsd: 38,
          actions30d: 44,
        },
      ],
    ),
  },
  audit: audit(
    [
      [
        "2026-10-12T04:10:00Z",
        "h:Priya Nair",
        "access",
        "Signed in",
        "web",
        "Entra ID · MFA (Authenticator)",
      ],
      [
        "2026-10-12T06:02:00Z",
        "a:builder-1",
        "agent",
        "Tool call blocked",
        "egress → registry.npmjs.org",
        "Policy: no outbound network beyond allowed tools",
        "denied",
      ],
      [
        "2026-10-13T08:30:00Z",
        "h:Vikram Joshi",
        "gate",
        "Approved G2",
        "rv-29 · Ledger idempotency keys",
        "Architecture key",
      ],
      ["2026-10-14T05:00:00Z", "s:scim", "identity", "Synced users", "Entra ID", "1 created, 2 updated"],
      [
        "2026-10-14T11:45:00Z",
        "h:Rohit Verma",
        "access",
        "Sign-in blocked",
        "web",
        "Outside allowed IP ranges and no compliant device",
        "denied",
        "45.33.12.9",
      ],
      [
        "2026-10-15T09:20:00Z",
        "a:security-agent",
        "security",
        "Raised finding",
        "PR-416",
        "High: SQL built from request input",
      ],
      [
        "2026-10-15T10:05:00Z",
        "a:explorer",
        "agent",
        "Read denied",
        "confluence/HR",
        "Policy: agents stay inside their project",
        "denied",
      ],
      [
        "2026-10-16T07:40:00Z",
        "h:Priya Nair",
        "security",
        "Changed control",
        "Redact PII · Customer names",
        "Turned off for the Support project pilot",
      ],
      [
        "2026-10-17T12:00:00Z",
        "a:release-agent",
        "agent",
        "Waiting for approval",
        "rel-11 · 25% → 50%",
        "Policy: production changes need a person",
      ],
      ["2026-10-17T12:18:00Z", "h:Arjun Das", "gate", "Approved G4", "rel-11", "Rollout step 50%"],
      [
        "2026-10-18T09:15:00Z",
        "s:scim",
        "identity",
        "Removed member",
        "vishal.k@acmepay.example",
        "Left the company · access revoked in 3 min",
      ],
      [
        "2026-10-19T06:30:00Z",
        "h:Neha Gupta",
        "integration",
        "Connected",
        "Microsoft 365 (Graph)",
        "Mail.Read on 3 shared mailboxes · admin consent",
      ],
      [
        "2026-10-20T12:00:00Z",
        "h:Priya Nair",
        "identity",
        "Added domain",
        "acme-ops.example",
        "Waiting for DNS TXT record",
      ],
      [
        "2026-10-21T03:12:00Z",
        "a:builder-2",
        "agent",
        "Commit blocked",
        "TSK-87 branch",
        "Policy: no secrets in code (Stripe test key)",
        "denied",
      ],
      ["2026-10-21T08:00:00Z", "h:Sunita Iyer", "gate", "Signed security review", "rv-31", "OWASP ASVS L2"],
      [
        "2026-10-22T13:00:00Z",
        "s:scim",
        "identity",
        "MFA missing",
        "karan.malhotra@acmepay.example",
        "No method registered in Entra ID",
        "failure",
      ],
      [
        "2026-10-23T08:30:00Z",
        "h:Priya Nair",
        "access",
        "Invited member",
        "farah.khan@acmepay.example",
        "Engineer",
      ],
      ["2026-10-23T09:10:00Z", "a:qa-agent", "agent", "Pushed test plan", "tp-sup → Xray", "232 cases"],
      [
        "2026-10-24T04:44:00Z",
        "a:sre-agent",
        "agent",
        "Proposed fix",
        "INC-231",
        "Scale ledger-svc pool; waiting for approval",
      ],
      ["2026-10-24T05:02:00Z", "h:Arjun Das", "gate", "Approved incident fix", "INC-231", "Runbook RB-12"],
      [
        "2026-10-24T18:00:00Z",
        "s:audit",
        "security",
        "Shipped to SIEM",
        "Microsoft Sentinel",
        "1,204 events · chain verified",
      ],
      [
        "2026-10-25T07:31:00Z",
        "a:explorer",
        "agent",
        "Budget warning",
        "explorer",
        "Over monthly budget (104%)",
        "failure",
      ],
      [
        "2026-10-25T10:40:00Z",
        "h:Rahul Mehta",
        "data",
        "Exported",
        "BRD-31 (docx)",
        "Classification: confidential",
      ],
      ["2026-10-26T05:30:00Z", "s:scim", "identity", "Synced users", "Entra ID", "0 created, 1 updated"],
      ["2026-10-26T05:40:00Z", "h:Priya Nair", "access", "Signed in", "web", "Entra ID · MFA (FIDO2 key)"],
    ],
    "203.0.113.24",
  ),
};

/* ── Northwind Bank ──────────────────────────────────────────────────────────────────────────── */

const nwIdp = (n: string) => `Entra Agent ID · ${n}@northwind.example`;

export const northwindSecurity: SecurityBundle = {
  security: {
    ip: "198.51.100.40",
    controls: workspaceControls({
      off: ["browser-speech"],
      idInfo: "Entra ID Conditional Access",
      ip: [
        { cidr: "198.51.100.0/25", label: "Dubai HQ" },
        { cidr: "192.0.2.128/27", label: "Abu Dhabi DR site" },
      ],
      siem: { kind: "siem", target: "sentinel", endpoint: "law-nwb-uaenorth" },
      sessionHours: 4,
      retentionDays: 2555,
    }),
    keys: key(
      "customer-key",
      "Azure Key Vault Managed HSM · UAE North",
      "kv-nwb-ae/tl-cmk",
      "2026-10-14T03:00:00Z",
      30,
      ["2026-09-14T03:00:00Z", "2026-08-15T03:00:00Z", "2026-07-16T03:00:00Z"],
    ),
  },
  members: {
    seatsTotal: 40,
    review: { lastAt: "2026-09-30T10:00:00Z", by: "Omar Haddad", everyDays: 90 },
    items: [
      member({
        id: YOU,
        name: "Priya Nair",
        email: "priya.nair@example.com",
        roles: ["architect"],
        source: "invite",
        groups: [],
        lastActiveAt: "2026-10-25T12:00:00Z",
        addedAt: "2026-04-12T09:00:00Z",
      }),
      member({
        id: "u_omar",
        name: "Omar Haddad",
        email: "omar.haddad@northwind.example",
        roles: ["tenant-admin", "product-owner"],
        groups: ["APP-TL-Admins", "APP-TL-Owners"],
      }),
      member({
        id: "u_layla",
        name: "Layla Hassan",
        email: "layla.hassan@northwind.example",
        roles: ["product-owner"],
        groups: ["APP-TL-Owners"],
      }),
      member({
        id: "u_yusuf",
        name: "Yusuf Karim",
        email: "yusuf.karim@northwind.example",
        roles: ["product-owner"],
        groups: ["APP-TL-Owners"],
      }),
      member({
        id: "u_hamza",
        name: "Hamza Qureshi",
        email: "hamza.qureshi@northwind.example",
        roles: ["tech-lead"],
        groups: ["APP-TL-Leads"],
      }),
      member({
        id: "u_sara",
        name: "Sara Al Hashimi",
        email: "sara.alhashimi@northwind.example",
        roles: ["tech-lead"],
        groups: ["APP-TL-Leads"],
      }),
      member({
        id: "u_karim",
        name: "Karim Nasser",
        email: "karim.nasser@northwind.example",
        roles: ["engineer"],
        groups: ["APP-TL-Engineers"],
      }),
      member({
        id: "u_fatima",
        name: "Fatima Al Mansoori",
        email: "fatima.almansoori@northwind.example",
        roles: ["viewer"],
        groups: ["APP-TL-Executives"],
        lastActiveAt: "2026-10-01T08:00:00Z",
      }),
      member({
        id: "u_reem",
        name: "Reem Saeed",
        email: "reem.saeed@northwind.example",
        roles: ["engineer"],
        grants: ["review.security.signoff", "audit.read"],
        groups: ["APP-TL-Engineers", "SEC-AppSec"],
      }),
      member({
        id: "u_nwbreak",
        name: "Break-glass admin",
        email: "tl-breakglass@northwind.example",
        roles: ["tenant-admin"],
        source: "invite",
        breakGlass: true,
        lastActiveAt: "2026-09-30T10:30:00Z",
      }),
    ],
  },
  identity: {
    sso: {
      protocol: "saml",
      provider: "Microsoft Entra ID",
      issuer: "https://sts.windows.net/4b2d…-northwind/",
      clientId: "urn:throughline:t_nwb21c",
      domains: [
        {
          domain: "northwind.example",
          verified: true,
          record: "tl-verify=nwb-51ad0e",
          addedAt: "2026-04-01T08:00:00Z",
        },
      ],
      enforced: true,
      jit: false,
      defaultRole: "viewer",
      lastLoginAt: "2026-10-26T04:50:00Z",
    },
    scim: {
      enabled: true,
      endpoint: "https://api.throughline.example/scim/v2/t_nwb21c",
      token: { last4: "u7Lm", createdAt: "2026-09-01T08:00:00Z", expiresAt: "2027-03-01T08:00:00Z" },
      lastSyncAt: "2026-10-26T04:45:00Z",
      users: 9,
      groups: 6,
      mappings: [
        { group: "APP-TL-Admins", roles: ["tenant-admin"] },
        { group: "APP-TL-Owners", roles: ["product-owner"] },
        { group: "APP-TL-Leads", roles: ["tech-lead"] },
        { group: "APP-TL-Engineers", roles: ["engineer"] },
        { group: "APP-TL-Executives", roles: ["viewer"] },
      ],
      log: [{ at: "2026-10-26T04:45:00Z", level: "info", message: "Sync complete: no changes" }],
    },
  },
  agentGov: {
    killSwitch: { engaged: false, at: null, by: null },
    killed: [],
    policies: policies([], {
      "prod-approval": 3,
      "two-person": 7,
      redact: 12,
      egress: 6,
      "project-scope": 2,
    }),
    agents: agents(
      nwIdp,
      { default: "Omar Haddad", "qa-agent": "Sara Al Hashimi", "security-agent": "Reem Saeed" },
      STANDARD_AGENTS.map((a) =>
        a.id === "builder-1" || a.id === "builder-2"
          ? { ...a, autonomy: "approve" as const, dataAccess: "internal" as const }
          : a.id === "explorer"
            ? { ...a, credential: { type: "managed-identity" as const, rotatedAt: "2026-10-01T00:00:00Z" } }
            : a,
      ),
    ),
  },
  audit: audit(
    [
      ["2026-10-14T03:00:00Z", "s:kms", "security", "Rotated key", "kv-nwb-ae/tl-cmk", "v4 · 30-day policy"],
      ["2026-10-15T06:00:00Z", "h:Omar Haddad", "access", "Signed in", "web", "SAML · Entra ID · MFA"],
      [
        "2026-10-16T09:30:00Z",
        "a:builder-1",
        "agent",
        "Waiting for approval",
        "INT-185 branch",
        "Autonomy: act after approval",
      ],
      ["2026-10-17T07:10:00Z", "h:Priya Nair", "gate", "Approved G2", "rv-185", "Architecture key"],
      [
        "2026-10-19T11:00:00Z",
        "h:Unknown",
        "access",
        "Sign-in blocked",
        "web",
        "Account not in workspace",
        "denied",
        "91.204.14.2",
      ],
      [
        "2026-10-20T05:20:00Z",
        "a:sre-agent",
        "agent",
        "Runbook blocked",
        "core-interest · prod",
        "Policy: production changes need a person",
        "denied",
      ],
      [
        "2026-10-21T08:45:00Z",
        "h:Reem Saeed",
        "gate",
        "Signed security review",
        "rv-185",
        "CBUAE controls mapped",
      ],
      [
        "2026-10-23T10:00:00Z",
        "h:Layla Hassan",
        "data",
        "Exported",
        "BRD-199 (pdf)",
        "Classification: restricted · watermarked",
      ],
      [
        "2026-10-24T18:00:00Z",
        "s:audit",
        "security",
        "Shipped to SIEM",
        "Microsoft Sentinel · UAE North",
        "642 events · chain verified",
      ],
      ["2026-10-26T04:45:00Z", "s:scim", "identity", "Synced users", "Entra ID", "No changes"],
    ],
    "198.51.100.40",
  ),
};

/* ── Fabrikam Retail ─────────────────────────────────────────────────────────────────────────── */

const fabIdp = (n: string) => `Workload Identity Federation · ${n}@fabrikam-tl.iam.example`;

export const fabrikamSecurity: SecurityBundle = {
  security: {
    ip: "192.0.2.77",
    controls: workspaceControls({
      off: ["scim", "ip", "siem", "retain"],
      idInfo: "Google Workspace context-aware access",
      siem: { kind: "siem", target: "chronicle", endpoint: "not configured" },
      sessionHours: 12,
      retentionDays: 90,
    }),
    keys: key(
      "platform-key",
      "Platform-managed key · AWS KMS us-east-1",
      "platform/pooled-us",
      "2026-09-26T00:00:00Z",
      365,
      ["2025-09-26T00:00:00Z"],
    ),
  },
  members: {
    seatsTotal: 10,
    review: { lastAt: null, by: null, everyDays: 180 },
    items: [
      member({
        id: YOU,
        name: "Priya Nair",
        email: "priya.nair@example.com",
        roles: ["viewer"],
        source: "invite",
        lastActiveAt: "2026-10-20T14:00:00Z",
        addedAt: "2026-08-02T09:00:00Z",
      }),
      member({
        id: "u_emma",
        name: "Emma Walsh",
        email: "emma.walsh@fabrikam.example",
        roles: ["tenant-admin", "product-owner"],
        source: "jit",
      }),
      member({
        id: "u_tom",
        name: "Tom Becker",
        email: "tom.becker@fabrikam.example",
        roles: ["product-owner"],
        source: "jit",
      }),
      member({
        id: "u_saral",
        name: "Sara Lind",
        email: "sara.lind@fabrikam.example",
        roles: ["tech-lead"],
        source: "jit",
      }),
      member({
        id: "u_mia",
        name: "Mia Hoffmann",
        email: "mia.hoffmann@fabrikam.example",
        roles: ["engineer"],
        source: "jit",
        mfa: false,
      }),
      member({
        id: "u_jonas",
        name: "Jonas Weber",
        email: "jonas.weber@fabrikam.example",
        roles: ["tenant-admin"],
        source: "jit",
        mfa: false,
        lastActiveAt: "2026-05-11T10:00:00Z",
      }),
    ],
  },
  identity: {
    sso: {
      protocol: "oidc",
      provider: "Google Workspace",
      issuer: "https://accounts.google.com",
      clientId: "88412-throughline-fabrikam.apps.googleusercontent.example",
      domains: [
        {
          domain: "fabrikam.example",
          verified: false,
          record: "tl-verify=fab-3e81aa",
          addedAt: "2026-08-02T09:00:00Z",
        },
      ],
      enforced: false,
      jit: true,
      defaultRole: "engineer",
      lastLoginAt: "2026-10-25T16:00:00Z",
    },
    scim: {
      enabled: false,
      endpoint: "https://api.throughline.example/scim/v2/t_fab4d0",
      token: null,
      lastSyncAt: null,
      users: 0,
      groups: 0,
      mappings: [],
      log: [],
    },
  },
  agentGov: {
    killSwitch: { engaged: false, at: null, by: null },
    killed: [],
    policies: policies(["deps", "budget"], { "prod-approval": 1, egress: 3 }),
    agents: agents(
      fabIdp,
      { default: "Emma Walsh" },
      STANDARD_AGENTS.filter((a) =>
        ["ba-agent", "builder-1", "reviewer", "release-agent", "explorer"].includes(a.id),
      ).map((a) => (a.id === "builder-1" ? { ...a, spentUsd: 455, budgetUsd: 400 } : a)),
    ),
  },
  audit: audit(
    [
      [
        "2026-10-18T14:00:00Z",
        "h:Emma Walsh",
        "access",
        "Signed in",
        "web",
        "Google Workspace · no MFA challenge",
      ],
      [
        "2026-10-19T09:00:00Z",
        "s:jit",
        "identity",
        "Created member",
        "mia.hoffmann@fabrikam.example",
        "First SSO sign-in · default role engineer",
      ],
      [
        "2026-10-20T14:00:00Z",
        "h:Priya Nair",
        "security",
        "Change refused",
        "Security controls",
        "Viewer role can't change security settings",
        "denied",
        "192.0.2.77",
      ],
      [
        "2026-10-22T10:30:00Z",
        "a:builder-1",
        "agent",
        "Budget exceeded",
        "builder-1",
        "114% of monthly budget · budget policy is off",
        "failure",
      ],
      ["2026-10-24T11:00:00Z", "h:Tom Becker", "gate", "Approved G1", "SPEC-12", "Loyalty points accrual"],
      [
        "2026-10-25T16:00:00Z",
        "h:Sara Lind",
        "access",
        "Signed in",
        "web",
        "Google Workspace · 2-step verification",
      ],
    ],
    "192.0.2.77",
  ),
};
