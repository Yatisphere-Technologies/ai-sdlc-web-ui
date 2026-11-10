import type {
  ArchBrief,
  ArchDecision,
  ArchDocSection,
  ArchSuggestion,
  DiagramCategory,
  EdgeKind,
} from "@throughline/contracts";
import type { ServiceRole } from "./catalog";

/**
 * A platform component the system needs beyond the standard building blocks (a tool registry, a
 * content filter, an agent directory). It is drawn in the container, deployment and security views
 * next to the entry point that uses it.
 */
export type SubjectComponent = {
  id: string;
  name: string;
  /** Picks the vendor shape in exports; reuse the closest existing role. */
  role: ServiceRole;
  category: DiagramCategory;
  /** Product and what it does here. */
  description: string;
  /** Trust zone in the security view. */
  zone: "app" | "identity" | "secops";
  /** How the system uses it: from the entry point (default), the API or the worker. */
  link: { kind: EdgeKind; label: string; from?: "entry" | "api" | "worker" };
  /** Also a lane in the sequence diagram. */
  inFlow?: boolean;
  /** BRD requirement ids it delivers. */
  serves?: string[];
  /** Why the solution needs it: what breaks or is at risk without it. */
  why?: string;
};

/** One message in a subject-specific key flow. Lanes: actor, edge, entry, idp, api, cache, db, bus,
 * worker, partner, onprem, notify, plus any component with `inFlow`. Steps whose lane the brief
 * leaves out (no cache, no edge…) are dropped. */
export type FlowStep = {
  from: string;
  to: string;
  label: string;
  kind: EdgeKind;
  note?: string;
  reply?: boolean;
};

/**
 * What the architect agent knows about the system before drawing: pulled from the approved spec,
 * the chosen design option and the connected tools. In production this comes from the work graph.
 */
export type ArchSubject = {
  id: string;
  workItemKey: string;
  title: string;
  /** Name of the system being designed. */
  system: string;
  purpose: string;
  peakLoad: string;
  latencyTarget: string;
  dataEntities: string;
  retention: string;
  actors: { id: string; name: string; description: string; channel: string; staff?: boolean }[];
  externals: {
    id: string;
    name: string;
    description: string;
    where: "partner" | "onprem" | "saas";
    protocol: string;
    /** False when the system only calls out to this partner (no partner caller in the security view). */
    callsIn?: boolean;
  }[];
  /** Workloads inside the system. The first is the synchronous API; "async" ones consume messages.
   * `serves` lists the BRD requirement ids each one delivers. */
  services: { id: string; name: string; description: string; async?: boolean; serves?: string[] }[];
  /** The main business transaction, named for the sequence diagram. */
  flow: {
    name: string;
    command: string;
    event: string;
    partnerCall: string;
    onpremCall?: string;
    notifyCall?: string;
    /** Replaces the generic request/outbox/worker flow when the system works differently. */
    steps?: FlowStep[];
    /** Caption for the sequence diagram when `steps` is set. */
    caption?: string;
  };
  /** Extra platform components (see SubjectComponent). */
  components?: SubjectComponent[];
  /** Subject-specific document sections, appended after the standard ones. */
  sections?: Omit<ArchDocSection, "id">[];
  /** Subject-specific decisions, appended to the design decisions. */
  decisions?: ArchDecision[];
  /** Component id → subject decision ids (AD-xx) behind it. */
  decisionFor?: Record<string, string[]>;
  /** Component id → BRD requirement ids it delivers, for standard components (entry, db, bus…). */
  servesFor?: Record<string, string[]>;
  /** Subject-specific risks: [risk, impact, mitigation, owner]. */
  risks?: string[][];
  /** Suggested answers with the evidence the agent found. */
  signals: Partial<Record<keyof ArchBrief, ArchSuggestion>>;
};

export const acmeSubject: ArchSubject = {
  id: "arch-31",
  workItemKey: "INT-31",
  title: "UPI AutoPay mandate cancellation",
  system: "Mandate platform",
  purpose:
    "Let customers cancel UPI AutoPay mandates from the app, revoke them with the PSP within NPCI timelines, and stop the ledger from collecting.",
  peakLoad: "1,200 requests/s at month-end, 9 M mandates",
  latencyTarget: "p95 under 300 ms for the cancel request",
  dataEntities: "Mandates, mandate events, idempotency keys, revoke attempts",
  retention: "10 years for mandate events (RBI), 30 days for idempotency keys",
  actors: [
    {
      id: "customer",
      name: "Customer",
      description: "Cancels mandates in the Acme app",
      channel: "Mobile app",
    },
    {
      id: "ops",
      name: "Payments operations",
      description: "Investigates failed revocations",
      channel: "Ops console",
      staff: true,
    },
  ],
  externals: [
    {
      id: "psp",
      name: "PSP / NPCI UPI switch",
      description: "Sponsor bank API that revokes the mandate",
      where: "partner",
      protocol: "HTTPS + mTLS",
    },
    {
      id: "ledger",
      name: "Core ledger",
      description: "Existing system of record for collections",
      where: "onprem",
      protocol: "REST over private link",
    },
    {
      id: "notify",
      name: "Notification gateway",
      description: "SMS and push to customers",
      where: "saas",
      protocol: "HTTPS",
    },
  ],
  services: [
    {
      id: "api",
      name: "Mandate API",
      description: "Accepts cancel requests, owns mandate state",
      serves: ["BR-01", "BR-02", "BR-03", "BR-09"],
    },
    {
      id: "worker",
      name: "Revoke worker",
      description: "Calls the PSP with retries and reconciles",
      async: true,
      serves: ["BR-04", "BR-05", "BR-06"],
    },
    {
      id: "console",
      name: "Ops console",
      description: "Web front end for operations staff",
      serves: ["BR-07", "BR-08"],
    },
  ],
  servesFor: {
    entry: ["BR-01", "BR-02"],
    bus: ["BR-04"],
    db: ["BR-02", "BR-03", "BR-09"],
    store: ["BR-09"],
    psp: ["BR-04"],
    ledger: ["BR-05"],
    notify: ["BR-06"],
  },
  flow: {
    name: "Cancel a mandate",
    command: "POST /mandates/{id}/cancel",
    event: "MandateCancelRequested",
    partnerCall: "Revoke mandate",
    onpremCall: "Stop future collections",
    notifyCall: "Send cancellation SMS",
  },
  signals: {
    cloud: {
      value: "azure",
      reason: "Entra ID, Azure DevOps and an Azure landing zone are already connected for this tenant.",
      basis: "evidenced",
    },
    compute: {
      value: "kubernetes",
      reason: "Payments services already run on AKS; the platform team owns the cluster baseline.",
      basis: "evidenced",
    },
    database: {
      value: "postgres",
      reason:
        "Mandate state needs transactions with a unique constraint on the idempotency key (SPEC-12, REQ-2).",
      basis: "inferred",
    },
    messaging: {
      value: "queue",
      reason: "The PSP times out under load; the chosen design (option B) retries revocations from a queue.",
      basis: "evidenced",
    },
    exposure: {
      value: "public",
      reason: "Customers cancel from the mobile app over the internet.",
      basis: "stated",
    },
    connectivity: {
      value: "private-circuit",
      reason: "The core ledger stays on-prem in Mumbai and an ExpressRoute circuit already exists.",
      basis: "evidenced",
    },
    identity: {
      value: "both",
      reason: "Customers use the app login; operations staff use Entra ID.",
      basis: "stated",
    },
    classification: {
      value: "restricted",
      reason: "Mandates hold payment instrument and account data.",
      basis: "stated",
    },
    compliance: {
      value: ["pci-dss", "rbi", "iso27001"],
      reason: "Payment data in India; Acme holds PCI DSS and ISO 27001 certificates.",
      basis: "evidenced",
    },
    availability: {
      value: "multi-region-warm",
      reason: "Payment systems are tier 1 at Acme: RTO 1 h, RPO 5 min. Assumed until the risk team confirms.",
      basis: "assumed",
    },
    ai: { value: "none", reason: "Nothing in the spec calls a model at runtime.", basis: "inferred" },
    observability: {
      value: "native",
      reason: "Acme sends telemetry to Azure Monitor and Sentinel today.",
      basis: "evidenced",
    },
  },
};

export const northwindSubject: ArchSubject = {
  id: "arch-199",
  workItemKey: "INT-199",
  title: "ISO 20022 pacs.008 migration",
  system: "Payments hub",
  purpose:
    "Accept corporate payment instructions, translate them to ISO 20022 pacs.008, and route them to SWIFT and UAEFTS while posting to core banking.",
  peakLoad: "300 payments/s at cut-off, 40 k corporate users",
  latencyTarget: "p95 under 800 ms to acknowledge an instruction",
  dataEntities: "Payment instructions, ISO 20022 messages, status events, audit trail",
  retention: "10 years for payment records (CBUAE)",
  actors: [
    {
      id: "corporate",
      name: "Corporate client",
      description: "Submits payments in online banking",
      channel: "Corporate portal",
    },
    {
      id: "ops",
      name: "Payments operations",
      description: "Repairs and releases payments",
      channel: "Ops console",
      staff: true,
    },
  ],
  externals: [
    {
      id: "swift",
      name: "SWIFT network",
      description: "Cross-border messages via Alliance Access",
      where: "onprem",
      protocol: "MQ over private link",
    },
    {
      id: "core",
      name: "Core banking (T24)",
      description: "Account postings and balances",
      where: "onprem",
      protocol: "REST over private link",
    },
    {
      id: "uaefts",
      name: "UAEFTS (CBUAE)",
      description: "Domestic clearing",
      where: "partner",
      protocol: "HTTPS + mTLS",
    },
  ],
  services: [
    {
      id: "api",
      name: "Payments API",
      description: "Validates and stores payment instructions",
      serves: ["BR-02", "BR-05"],
    },
    {
      id: "worker",
      name: "Translation worker",
      description: "Builds pacs.008 and routes it",
      async: true,
      serves: ["BR-01", "BR-03", "BR-04"],
    },
    {
      id: "console",
      name: "Ops console",
      description: "Repair and release queue for operations",
      serves: ["BR-06"],
    },
  ],
  flow: {
    name: "Submit a payment",
    command: "POST /payments",
    event: "PaymentAccepted",
    partnerCall: "Send pacs.008",
    onpremCall: "Post debit to account",
    notifyCall: "Send status update",
  },
  signals: {
    cloud: {
      value: "azure",
      reason: "Northwind runs a dedicated Azure landing zone in UAE North.",
      basis: "evidenced",
    },
    compute: {
      value: "kubernetes",
      reason: "The bank's platform standard is AKS with a service mesh.",
      basis: "evidenced",
    },
    database: {
      value: "sqlserver",
      reason: "The payments team runs SQL Server today and owns the DBA skills.",
      basis: "evidenced",
    },
    messaging: {
      value: "stream",
      reason: "Status events fan out to five consumers and must be replayable.",
      basis: "inferred",
    },
    exposure: {
      value: "partner",
      reason: "Only the corporate portal and UAEFTS call the hub.",
      basis: "stated",
    },
    connectivity: {
      value: "private-circuit",
      reason: "SWIFT and T24 stay on-prem; ExpressRoute is in place.",
      basis: "evidenced",
    },
    identity: { value: "both", reason: "Corporate users and staff sign in separately.", basis: "stated" },
    classification: { value: "restricted", reason: "Customer account and payment data.", basis: "stated" },
    compliance: {
      value: ["cbuae", "pci-dss", "iso27001"],
      reason: "UAE bank regulated by CBUAE.",
      basis: "stated",
    },
    keys: {
      value: "hsm",
      reason: "Bank policy requires keys in a single-tenant FIPS 140-3 Level 3 HSM.",
      basis: "stated",
    },
    availability: {
      value: "multi-region-warm",
      reason: "Payments are critical; CBUAE expects tested DR.",
      basis: "inferred",
    },
    ai: { value: "none", reason: "No model calls in scope.", basis: "inferred" },
    observability: { value: "native", reason: "Telemetry must stay in-country.", basis: "inferred" },
  },
};

export const fabrikamSubject: ArchSubject = {
  id: "arch-12",
  workItemKey: "INT-12",
  title: "Loyalty points expiry",
  system: "Loyalty service",
  purpose:
    "Expire loyalty points on schedule, warn shoppers in advance, and keep store and online balances in step.",
  peakLoad: "2,000 balance reads/s during sales, nightly expiry batch of 4 M accounts",
  latencyTarget: "p95 under 150 ms for balance reads",
  dataEntities: "Loyalty accounts, points ledger, expiry schedule",
  retention: "3 years for points history",
  actors: [
    {
      id: "shopper",
      name: "Shopper",
      description: "Checks points in the app and web store",
      channel: "Web and mobile",
    },
    {
      id: "staff",
      name: "Store staff",
      description: "Adjusts balances at the till",
      channel: "Admin console",
      staff: true,
    },
  ],
  externals: [
    {
      id: "pos",
      name: "Store POS",
      description: "Redeems points at checkout",
      where: "partner",
      protocol: "HTTPS + API key",
    },
    {
      id: "crm",
      name: "CRM (Salesforce)",
      description: "Marketing journeys",
      where: "saas",
      protocol: "HTTPS",
    },
    {
      id: "email",
      name: "Email provider",
      description: "Expiry reminders",
      where: "saas",
      protocol: "HTTPS",
    },
  ],
  services: [
    { id: "api", name: "Loyalty API", description: "Balances, earn and burn", serves: ["BR-03"] },
    {
      id: "worker",
      name: "Expiry worker",
      description: "Runs expiry and sends reminders",
      async: true,
      serves: ["BR-01", "BR-02"],
    },
    { id: "console", name: "Admin console", description: "Balance adjustments for staff" },
  ],
  flow: {
    name: "Redeem points",
    command: "POST /accounts/{id}/redeem",
    event: "PointsRedeemed",
    partnerCall: "Confirm redemption to POS",
    notifyCall: "Send receipt email",
  },
  signals: {
    cloud: { value: "aws", reason: "The e-commerce platform and data lake run on AWS.", basis: "evidenced" },
    compute: {
      value: "serverless-containers",
      reason: "Small team, no platform engineers; Fargate keeps ops light.",
      basis: "inferred",
    },
    database: {
      value: "nosql",
      reason: "Key-value balance reads at high volume; DynamoDB is already used for carts.",
      basis: "evidenced",
    },
    messaging: { value: "queue", reason: "Expiry runs as batched jobs with retries.", basis: "inferred" },
    exposure: { value: "public", reason: "Shoppers read balances from the web store.", basis: "stated" },
    connectivity: {
      value: "none",
      reason: "Stores reach the API over the internet with API keys.",
      basis: "evidenced",
    },
    identity: {
      value: "customer",
      reason: "Shoppers use the store account; staff use the same console login.",
      basis: "assumed",
    },
    classification: {
      value: "confidential",
      reason: "Names, emails and purchase history (PII).",
      basis: "stated",
    },
    compliance: { value: ["ccpa", "soc2"], reason: "US shoppers including California.", basis: "inferred" },
    availability: {
      value: "zone-redundant",
      reason: "Loyalty is tier 2; a region outage can degrade to read-only.",
      basis: "assumed",
    },
    ai: {
      value: "managed",
      reason: "The spec asks for personalised expiry reminders written by a model.",
      basis: "stated",
    },
    observability: {
      value: "datadog",
      reason: "Fabrikam's on-call already lives in Datadog.",
      basis: "evidenced",
    },
  },
};

/**
 * Acme's MCP governance platform: every agent tool call goes through one governed path on Azure.
 * Product facts and preview status were checked on 25 Oct 2026 (Microsoft Learn, MCP spec
 * 2026-07-28, OWASP MCP Top 10); recheck them before reusing this subject elsewhere.
 */
export const acmeMcpSubject: ArchSubject = {
  id: "arch-52",
  workItemKey: "INT-52",
  title: "MCP governance on Azure",
  system: "MCP governance platform",
  purpose:
    "Route every MCP tool call an agent makes through one governed path: discovered in a private registry, enforced at a gateway, authorised with the agent's own identity, screened for prompt injection and recorded for audit.",
  peakLoad: "400 tool calls/s across ~120 agents, 40 MCP servers",
  latencyTarget: "p95 under 150 ms added by the gateway (content safety measured separately)",
  dataEntities: "Server and tool registry snapshots, onboarding requests, approvals, tool-call audit index",
  retention: "90 days interactive for tool-call records, then archive for 8 years (regulated audit)",
  actors: [
    {
      id: "agents",
      name: "AI agents",
      description: "Foundry, Copilot Studio and in-house agents, including the BRD-40 email listener",
      channel: "MCP over streamable HTTP",
    },
    {
      id: "admins",
      name: "Platform and security admins",
      description: "Onboard servers, approve access, block a server in an incident",
      channel: "Governance portal",
      staff: true,
    },
  ],
  externals: [
    {
      id: "vendor",
      name: "Vendor MCP servers",
      description: "Contracted, vendor-hosted servers (GitHub, Atlassian, ServiceNow)",
      where: "partner",
      protocol: "MCP + OAuth (credential manager)",
      callsIn: false,
    },
    {
      id: "core",
      name: "Enterprise systems",
      description: "Systems of record the first-party servers wrap (CRM, ticketing, core banking read APIs)",
      where: "onprem",
      protocol: "REST over private link",
    },
    {
      id: "oncall",
      name: "Security on-call",
      description: "Teams channel and ServiceNow incident queue",
      where: "saas",
      protocol: "HTTPS webhook",
    },
  ],
  services: [
    {
      id: "api",
      name: "First-party MCP servers",
      description: "Stateless servers over Acme systems; accept calls only from the gateway identity",
      serves: ["BR-01", "BR-03"],
    },
    {
      id: "worker",
      name: "Tool-call auditor",
      description: "Indexes audit events and diffs tools/list against the registry",
      async: true,
      serves: ["BR-08", "BR-09"],
    },
    {
      id: "console",
      name: "Governance portal",
      description: "Server onboarding, access requests and approvals",
      serves: ["BR-07", "BR-10"],
    },
  ],
  components: [
    {
      id: "mcp-registry",
      why: "Without one inventory, nobody can say which servers and tools agents may use; unregistered (shadow) servers would go unnoticed and the gateway would have nothing to enforce.",
      name: "MCP registry",
      role: "api-catalog",
      category: "integration",
      description: "Azure API Center · approved servers, owners, trust tier, allowed tools",
      zone: "app",
      link: { kind: "data", label: "Server list" },
      serves: ["BR-04", "BR-05", "BR-12"],
    },
    {
      id: "content-safety",
      why: "Injected instructions usually arrive in tool output, not in the user's prompt; without screening, a poisoned tool result can steer the agent.",
      name: "Prompt-injection screen",
      role: "content-safety",
      category: "security",
      description: "Azure AI Content Safety · Prompt Shields on tool arguments and results",
      zone: "app",
      link: { kind: "request", label: "Prompt Shields" },
      serves: ["BR-06"],
      inFlow: true,
    },
    {
      id: "agent-id",
      why: "Every call must be attributable to a specific agent and the person it acts for; shared keys can't be governed with Conditional Access or revoked per agent.",
      name: "Agent identities",
      role: "agent-identity",
      category: "identity",
      description: "Microsoft Entra Agent ID · blueprints, sponsors, Conditional Access for agents",
      zone: "identity",
      link: { kind: "identity", label: "Agent attribution" },
      serves: ["BR-02", "BR-03"],
    },
  ],
  flow: {
    name: "Governed tool call",
    command: "POST /mcp · tools/call",
    event: "ToolCallAudited",
    partnerCall: "tools/list (drift check)",
    onpremCall: "Read record",
    notifyCall: "Drift alert",
    caption:
      "The agent's token stops at the gateway, which mints a new one for the server; the result is screened before it reaches the model, because injected instructions usually arrive in tool output.",
    steps: [
      {
        from: "actor",
        to: "edge",
        label: "POST /mcp · tools/call",
        kind: "request",
        note: "Mcp-Method / Mcp-Name headers · bearer token for the agent identity",
      },
      { from: "edge", to: "entry", label: "Forward (WAF passed)", kind: "request" },
      { from: "entry", to: "idp", label: "Fetch signing keys (cached)", kind: "identity" },
      { from: "idp", to: "entry", label: "JWKS", kind: "identity", reply: true },
      {
        from: "entry",
        to: "cache",
        label: "Rate limit per agent + user",
        kind: "data",
        note: "After aud = server URI, Agent ID and tool allow-list checks",
      },
      { from: "entry", to: "content-safety", label: "Prompt Shields on arguments", kind: "request" },
      { from: "content-safety", to: "entry", label: "No attack detected", kind: "request", reply: true },
      {
        from: "entry",
        to: "api",
        label: "tools/call with a new backend token",
        kind: "request",
        note: "Managed identity; the caller's token never leaves the gateway",
      },
      { from: "api", to: "onprem", label: "Read record", kind: "private" },
      { from: "api", to: "entry", label: "Tool result", kind: "request", reply: true },
      { from: "entry", to: "content-safety", label: "Screen result (indirect injection)", kind: "request" },
      {
        from: "entry",
        to: "bus",
        label: "Emit ToolCallAudited",
        kind: "async",
        note: "Agent, user, server, tool, verdict, latency, correlation id",
      },
      { from: "entry", to: "actor", label: "Tool result", kind: "request", reply: true },
      { from: "bus", to: "worker", label: "Deliver ToolCallAudited", kind: "async" },
      { from: "worker", to: "db", label: "Index audit record", kind: "data" },
      {
        from: "worker",
        to: "partner",
        label: "tools/list (daily drift check)",
        kind: "request",
        note: "Compared with the registry snapshot",
      },
      { from: "partner", to: "worker", label: "Tool definitions", kind: "request", reply: true },
      { from: "worker", to: "notify", label: "Drift alert (tool changed)", kind: "request" },
    ],
  },
  decisionFor: { entry: ["AD-12"], "agent-id": ["AD-13"], "mcp-registry": ["AD-14"] },
  servesFor: {
    entry: ["BR-01", "BR-02", "BR-03", "BR-05", "BR-06", "BR-07", "BR-11"],
    bus: ["BR-08"],
    db: ["BR-08", "BR-10"],
    store: ["BR-08"],
    firewall: ["BR-01"],
    cache: ["BR-11"],
  },
  decisions: [
    {
      id: "AD-12",
      title: "MCP enforcement point",
      context:
        "Where tool-call policy runs. MCP servers come from Acme teams, vendors and open source; policy inside each server would differ and could be bypassed.",
      options: [
        {
          name: "API Management Premium v2 as the only MCP ingress, per region",
          pros: [
            "Generally available with SLA, VNet injection and availability zones",
            "MCP servers (REST-as-MCP and passthrough) supported in classic and v2 tiers",
            "Supported by Agent 365 governance (v1 tiers are not)",
          ],
          cons: [
            "Governs tools only, not resources or prompts",
            "Policies apply per server, not per tool",
            "MCP is not supported in APIM workspaces; v2 has no multi-region",
          ],
          fit: "chosen",
        },
        {
          name: "APIM AI Gateway tier",
          pros: ["Tool-level blocking and tool threat protection", "One endpoint for models and tools"],
          cons: ["Preview, no SLA", "East US 2 and Sweden Central only, so no India residency"],
          fit: "rejected",
        },
        {
          name: "Policy inside each MCP server",
          pros: ["No shared component to run"],
          cons: ["Inconsistent and unauditable", "Any agent that skips the policy reaches the tool"],
          fit: "rejected",
        },
      ],
      decision:
        "API Management Premium v2 as the only MCP ingress. GA with SLA and zones; the AI Gateway tier is piloted in a separate subscription until it is GA in an Indian region.",
      consequences: [
        "Read and write tools live on separate MCP APIs so per-server policy is not too coarse",
        "A second APIM instance in the DR region, deployed from the same APIOps pipeline",
        "MCP servers rely on tools only; resources are blocked at the server",
      ],
    },
    {
      id: "AD-13",
      title: "Agent identity and token handling",
      context: "Which identity a tool call carries and which token reaches the MCP server.",
      options: [
        {
          name: "Entra Agent ID per agent; gateway validates aud and mints a backend token",
          pros: [
            "Conditional Access, ID Protection and access packages apply to agents (GA April 2026)",
            "Every agent has a human sponsor",
            "Matches the MCP authorization spec: audience binding, no token passthrough",
          ],
          cons: ["Every agent needs a blueprint and a sponsor before it can call tools"],
          fit: "chosen",
        },
        {
          name: "Shared app registrations or API keys per team",
          pros: ["Quick to set up"],
          cons: ["No attribution to an agent", "Keys leak and are never rotated"],
          fit: "rejected",
        },
        {
          name: "Forward the caller's token to the server",
          pros: ["No credential store at the gateway"],
          cons: ["Forbidden by the MCP spec; opens confused-deputy attacks"],
          fit: "rejected",
        },
      ],
      decision:
        "Entra Agent ID for every agent. The gateway checks that aud equals the server's canonical URI and that the token belongs to a registered agent, then gets a new token from managed identity or the APIM credential manager.",
      consequences: [
        "Dynamic Client Registration stays off (deprecated in the 2026-07-28 spec)",
        "Vendor servers use per-user OAuth through the credential manager until Entra ID-JAG is GA",
      ],
    },
    {
      id: "AD-14",
      title: "Registry and onboarding",
      context: "How a server becomes reachable, and how agents and IDEs find it.",
      options: [
        {
          name: "API Center is the system of record; APIOps publishes to APIM",
          pros: [
            "One inventory for agents, IDEs (GitHub Registry only mode) and Agent 365",
            "Data-plane MCP server is GA",
          ],
          cons: ["GitHub needs anonymous read on the registry, so it lists names and URLs only"],
          fit: "chosen",
        },
        {
          name: "Wiki or spreadsheet allow-list",
          pros: ["No tooling"],
          cons: ["Nothing enforces it"],
          fit: "rejected",
        },
      ],
      decision:
        "API Center is the system of record. No server is reachable until it is reviewed, registered with an owner and trust tier, and published through APIOps.",
      consequences: [
        "Tool lists are versioned; a change to a server's tools is a new version and a new review",
        "The auditor diffs tools/list against the registry daily and alerts on drift",
      ],
    },
  ],
  sections: [
    {
      title: "MCP gateway policy chain",
      intro:
        "Every MCP API in API Management runs the same chain, in this order. A call that fails a step stops there and is logged with the reason. The chain is a policy fragment kept in Git and deployed with APIOps.",
      tables: [
        {
          caption: "Inbound and outbound policy",
          table: {
            columns: ["Order", "Stage", "APIM policy", "What it enforces"],
            rows: [
              ["1", "Kill switch", "return-response (managed fragment)", "Server-level block returns 403"],
              [
                "2",
                "Network",
                "ip-filter, private ingress only",
                "Calls come from agent subnets or Front Door",
              ],
              [
                "3",
                "Authentication",
                "validate-azure-ad-token",
                "Issuer, signature, expiry, aud = this server's canonical URI",
              ],
              [
                "4",
                "Agent attribution",
                "claims check + set-variable",
                "Token belongs to a registered Agent ID",
              ],
              [
                "5",
                "Tool allow-list",
                "choose on Mcp-Method / Mcp-Name",
                "Only tools/list and allow-listed tools/call pass",
              ],
              [
                "6",
                "Rate and quota",
                "rate-limit-by-key, quota-by-key",
                "Per agent + user; lower for write tools",
              ],
              [
                "7",
                "Input screening",
                "llm-content-safety (shield-prompt)",
                "Prompt injection in tool arguments",
              ],
              [
                "8",
                "Backend credential",
                "authentication-managed-identity / get-authorization-context",
                "Fresh backend token; caller's token removed",
              ],
              [
                "9",
                "Forward",
                "set-backend-service + circuit breaker",
                "Only the gateway reaches the server",
              ],
              [
                "10",
                "Output screening",
                "llm-content-safety on the response",
                "Injected instructions in results",
              ],
              [
                "11",
                "Audit",
                "emit-metric, diagnostics, log-to-eventhub",
                "Who, which agent, which tool, verdict",
              ],
            ],
          },
        },
      ],
      bullets: [
        "With streaming responses, content safety stops forwarding events without an error; agents must handle an abrupt end.",
        "Fail closed: if authentication, policy or content safety cannot run, the call is refused.",
      ],
    },
    {
      title: "MCP threat model (OWASP MCP Top 10)",
      intro:
        "Each risk has a preventive control at the gateway or identity layer and a detective control in Sentinel; none relies on the MCP server behaving well.",
      tables: [
        {
          caption: "Controls per risk",
          table: {
            columns: ["Risk", "Preventive control", "Detective control"],
            rows: [
              [
                "MCP01 Token mismanagement and secret exposure",
                "No passthrough; backend tokens from managed identity or credential manager",
                "Defender for Key Vault; secret scanning in CI",
              ],
              [
                "MCP02 Privilege escalation via scope creep",
                "Scopes per tool group; access packages with expiry",
                "Alert on new scope grants to agent identities",
              ],
              [
                "MCP03 Tool poisoning",
                "Tool descriptions reviewed at onboarding; static allow-list; version pinning",
                "Daily tools/list diff against the registry",
              ],
              [
                "MCP04 Supply chain",
                "Re-host community servers from pinned, signed images",
                "Defender for Containers findings",
              ],
              [
                "MCP05 Command injection",
                "No raw shell tools; sandboxed execution only",
                "Content-safety and WAF hits on arguments",
              ],
              [
                "MCP06 Prompt injection via payloads",
                "shield-prompt on arguments and results",
                "Content-safety block rate per tool",
              ],
              [
                "MCP07 Weak authentication and authorization",
                "Entra JWT with audience binding; servers accept only the gateway identity",
                "Failed-auth and audience-mismatch alerts",
              ],
              [
                "MCP08 Lack of audit and telemetry",
                "Every call logged with agent, user, tool, verdict",
                "Alert on log-volume gaps per server",
              ],
              [
                "MCP09 Shadow MCP servers",
                "Servers reachable only from the gateway; registry-only IDEs",
                "Defender discovery of unsanctioned MCP endpoints",
              ],
              [
                "MCP10 Context injection and over-sharing",
                "Purview DLP and labels on tool results; minimal fields per tool",
                "Purview alerts on sensitive data in AI interactions",
              ],
            ],
          },
        },
      ],
    },
    {
      title: "Server onboarding and trust tiers",
      tables: [
        {
          caption: "Trust tiers",
          table: {
            columns: ["Tier", "Examples", "Hosting", "Minimum review"],
            rows: [
              [
                "1 · First-party",
                "Servers over Acme systems",
                "Acme subscription, private networking",
                "Code review, SAST, threat model, tool descriptions checked for hidden instructions",
              ],
              [
                "2 · Vendor-hosted",
                "GitHub, Atlassian, ServiceNow",
                "Vendor, through the gateway",
                "Vendor assessment, data-processing terms, scopes limited to tools in use",
              ],
              [
                "3 · Community",
                "Open-source servers",
                "Re-hosted from a pinned, scanned image",
                "Supply-chain review; read-only tools unless promoted",
              ],
            ],
          },
        },
      ],
      bullets: [
        "Request → review → build or re-host → register in API Center → publish with APIOps → grant through Entra access packages → operate → retire.",
        "Retiring a server: blocked in APIM, deprecated in API Center, access packages expired, deleted after 30 days.",
      ],
    },
    {
      title: "Platform status (checked 25 Oct 2026)",
      intro: "Preview features stay off the production path until they are GA in the region Acme needs.",
      tables: [
        {
          caption: "Building blocks",
          table: {
            columns: ["Building block", "Status", "Use here"],
            rows: [
              [
                "API Management Premium v2 (MCP servers)",
                "GA; tools only, not in workspaces",
                "Production gateway",
              ],
              ["llm-content-safety on MCP (shield-prompt)", "GA (Build 2026)", "Production"],
              ["API Center registry + data-plane MCP server", "GA", "Production"],
              ["Microsoft Entra Agent ID", "GA (April 2026)", "Production"],
              [
                "Agent 365 + APIM governance",
                "Preview; v2 tiers only",
                "Inventory and emergency block, pilot",
              ],
              [
                "APIM AI Gateway tier",
                "Preview; East US 2 and Sweden Central; no SLA",
                "Pilot subscription only",
              ],
              ["Entra ID-JAG (enterprise-managed authorization)", "Not GA", "Planned, not depended on"],
            ],
          },
        },
      ],
    },
  ],
  risks: [
    [
      "APIM policy is per server, not per tool",
      "A risky tool shares limits with safe ones",
      "Separate MCP APIs for read and write tools; allow-list on Mcp-Name",
      "Platform team",
    ],
    [
      "Agents call MCP servers directly",
      "Bypasses every gateway control",
      "Servers have no public endpoint and accept only the gateway identity and subnet",
      "Network team",
    ],
    [
      "Foundry require_approval is advisory",
      "A faulty runtime can skip human approval",
      "Approval enforced in the agent runtime and a stricter write-tool policy at the gateway",
      "Agent owners",
    ],
    [
      "Content Safety or Premium v2 not in the residency region",
      "Data leaves India for screening",
      "Confirm regional availability before G2; block the design until confirmed",
      "Architecture lead",
    ],
  ],
  signals: {
    cloud: {
      value: "azure",
      reason:
        "Agents run in Foundry and Copilot Studio; Entra ID and the Azure landing zone are already connected.",
      basis: "evidenced",
    },
    compute: {
      value: "serverless-containers",
      reason:
        "First-party MCP servers are small and stateless (the 2026-07-28 spec removed sessions); Container Apps scales them to zero.",
      basis: "inferred",
    },
    database: {
      value: "postgres",
      reason: "Registry snapshots, approvals and the audit index are relational and need transactions.",
      basis: "inferred",
    },
    cache: {
      value: "yes",
      reason: "Rate-limit counters and cached signing keys at the gateway.",
      basis: "inferred",
    },
    messaging: {
      value: "stream",
      reason:
        "APIM streams one audit event per tool call to Event Hubs; the auditor and Sentinel both read it.",
      basis: "evidenced",
    },
    exposure: {
      value: "partner",
      reason:
        "Only known agents call the gateway (Foundry, Copilot Studio, agent subnets); nothing is open to anonymous users.",
      basis: "stated",
    },
    topology: {
      value: "hub-spoke",
      reason:
        "Spoke-to-spoke traffic goes through the hub firewall, which also holds the egress allow-list for vendor servers.",
      basis: "evidenced",
    },
    connectivity: {
      value: "private-circuit",
      reason: "First-party servers read systems of record on-prem over the existing ExpressRoute circuit.",
      basis: "evidenced",
    },
    identity: {
      value: "workforce",
      reason: "Agents and admins both authenticate with Entra ID (Agent ID for agents).",
      basis: "stated",
    },
    classification: {
      value: "confidential",
      reason: "Tool results can carry customer and ticket data; restricted data needs a per-tool approval.",
      basis: "inferred",
    },
    compliance: {
      value: ["rbi", "iso27001"],
      reason: "Acme is RBI-regulated and ISO 27001 certified; AI governance maps to ISO/IEC 42001 later.",
      basis: "evidenced",
    },
    availability: {
      value: "multi-region-warm",
      reason:
        "The gateway is tier 0: if it is down, every agent loses its tools. v2 has no multi-region, so the DR region runs its own instance.",
      basis: "inferred",
    },
    ai: {
      value: "none",
      reason:
        "The platform calls Content Safety (a classifier, drawn as its own component), not a generative model.",
      basis: "inferred",
    },
    observability: {
      value: "native",
      reason: "Tool-call records go to the Sentinel workspace in Log Analytics.",
      basis: "evidenced",
    },
  },
};

/**
 * Acme's agentic email listener (BRD-40). It is the first production consumer of the MCP
 * governance platform (INT-52): every tool call it makes to ServiceNow or the CRM goes through the
 * governed gateway with its own Entra Agent ID.
 */
export const emailListenerSubject: ArchSubject = {
  id: "arch-40",
  workItemKey: "INT-40",
  title: "Agentic email listener for support emails",
  system: "Support email agent",
  purpose:
    "Read every inbound support email within a minute, classify it, redact personal data, open and route the ServiceNow case, draft a grounded reply for a person to approve, and resolve a small allow-list of low-risk requests on its own.",
  peakLoad: "3,000 emails/hour after incidents; 14,000 a week",
  latencyTarget: "Acknowledgement within 15 minutes; triage p95 under 60 s from arrival",
  dataEntities: "Emails and attachments, classifications, case links, drafts, approvals, audit events",
  retention: "Emails and audit 8 years (RBI complaints); drafts 1 year",
  actors: [
    {
      id: "agents",
      name: "Support agents",
      description: "Approve drafts, handle complaints and anything the agent is unsure about",
      channel: "Agent console",
      staff: true,
    },
  ],
  externals: [
    {
      id: "servicenow",
      name: "ServiceNow CSM",
      description: "Case management; reached only through the MCP governance gateway",
      where: "partner",
      protocol: "MCP via INT-52 gateway",
      callsIn: false,
    },
    {
      id: "crm",
      name: "Customer CRM",
      description: "Customer and account records, read through a first-party MCP server",
      where: "onprem",
      protocol: "REST over private link",
    },
    {
      id: "mailbox",
      name: "Support mailboxes",
      description: "Exchange Online shared mailboxes; new-mail notifications through Microsoft Graph",
      where: "saas",
      protocol: "Microsoft Graph",
    },
  ],
  services: [
    {
      id: "api",
      name: "Email intake API",
      description: "Receives new-mail notifications, stores each email once, serves the console",
      serves: ["BR-01", "BR-02", "BR-08"],
    },
    {
      id: "worker",
      name: "Triage agent",
      description: "Classifies, redacts, finds the customer, opens the case and drafts the reply",
      async: true,
      serves: ["BR-03", "BR-04", "BR-06", "BR-07", "BR-09", "BR-10", "BR-11"],
    },
    {
      id: "console",
      name: "Agent console",
      description: "Review queue, approve or edit drafts, switch intents off",
      serves: ["BR-12", "BR-13", "BR-14"],
    },
  ],
  components: [
    {
      id: "pii",
      why: "Customer emails carry personal and account data; masking it before any model call keeps the model, prompts and logs free of it (DPDP, RBI).",
      name: "Personal data redaction",
      role: "language",
      category: "ai",
      description: "Azure AI Language · detects and masks PII before any model call",
      zone: "app",
      link: { kind: "request", label: "Mask PII", from: "worker" },
      inFlow: true,
      serves: ["BR-05"],
    },
    {
      id: "kb-search",
      why: "Drafts must be grounded in approved articles, not the model's memory, so agents can trust and approve them quickly.",
      name: "Knowledge search",
      role: "search",
      category: "data",
      description: "Azure AI Search · approved knowledge-base articles for grounded replies",
      zone: "app",
      link: { kind: "data", label: "Grounding", from: "worker" },
      serves: ["BR-10"],
    },
    {
      id: "mcp-gateway",
      why: "The listener changes cases in ServiceNow; doing that through the governed gateway gives it an identity, an allow-list of tools, screening and an audit trail it would otherwise have to build.",
      name: "Governed tool gateway",
      role: "apigw",
      category: "integration",
      description: "MCP governance platform (INT-52) · ServiceNow and CRM tools through API Management",
      zone: "app",
      link: { kind: "request", label: "Tool calls (Agent ID)", from: "worker" },
      inFlow: true,
      serves: ["BR-07", "BR-11"],
    },
  ],
  flow: {
    name: "Triage a support email",
    command: "Graph change notification",
    event: "EmailReceived",
    partnerCall: "Create case",
    onpremCall: "Look up customer",
    notifyCall: "Send acknowledgement",
    caption:
      "The email is stored once and acknowledged fast; everything the agent does to other systems goes through the governed MCP gateway with its own identity, and personal data is masked before the model sees it.",
    steps: [
      {
        from: "notify",
        to: "api",
        label: "New mail notification",
        kind: "request",
        note: "Microsoft Graph change notification",
      },
      { from: "api", to: "notify", label: "Fetch message and attachments", kind: "request" },
      { from: "api", to: "cache", label: "Seen this message id?", kind: "data" },
      { from: "api", to: "db", label: "Store email + outbox row", kind: "data" },
      { from: "api", to: "bus", label: "Publish EmailReceived", kind: "async" },
      { from: "bus", to: "worker", label: "Deliver EmailReceived", kind: "async" },
      { from: "worker", to: "pii", label: "Mask personal data", kind: "request" },
      { from: "pii", to: "worker", label: "Masked text", kind: "request", reply: true },
      {
        from: "worker",
        to: "llm",
        label: "Classify intent and urgency; draft reply",
        kind: "request",
        note: "Azure OpenAI in Central India · private endpoint · grounded on approved articles",
      },
      { from: "llm", to: "worker", label: "Intent, confidence, draft", kind: "request", reply: true },
      {
        from: "worker",
        to: "mcp-gateway",
        label: "tools/call lookup_customer, create_case",
        kind: "request",
        note: "Agent ID token; allow-listed tools; arguments and results screened",
      },
      { from: "mcp-gateway", to: "onprem", label: "Read customer (first-party server)", kind: "private" },
      { from: "mcp-gateway", to: "partner", label: "Create case in ServiceNow", kind: "request" },
      { from: "partner", to: "mcp-gateway", label: "Case CS0012345", kind: "request", reply: true },
      { from: "mcp-gateway", to: "worker", label: "Tool results", kind: "request", reply: true },
      { from: "worker", to: "db", label: "Save classification, case, draft", kind: "data" },
      { from: "worker", to: "notify", label: "Send acknowledgement with case ref", kind: "request" },
      {
        from: "api",
        to: "actor",
        label: "Draft waiting for approval",
        kind: "request",
        note: "Complaints and low confidence always go to a person",
      },
    ],
  },
  servesFor: {
    bus: ["BR-01"],
    db: ["BR-08", "BR-09", "BR-12"],
    cache: ["BR-01"],
    llm: ["BR-03", "BR-10"],
    store: ["BR-02"],
    mailbox: ["BR-01", "BR-08"],
    servicenow: ["BR-07"],
    crm: ["BR-04"],
  },
  risks: [
    [
      "Model misclassifies a complaint as routine",
      "RBI timeline breach",
      "Complaint detection runs first and always routes to a person; weekly accuracy review",
      "Support operations",
    ],
    [
      "MCP governance platform not live in time",
      "Listener can't create cases",
      "Shared milestone with INT-52; pilot uses the gateway in pre-production",
      "Programme manager",
    ],
  ],
  signals: {
    cloud: {
      value: "azure",
      reason:
        "Azure OpenAI in Central India is the AI CoE's approved model endpoint; mail is in Exchange Online.",
      basis: "evidenced",
    },
    compute: {
      value: "serverless-containers",
      reason:
        "Bursty load (3,000 emails/hour after incidents, quiet nights); Container Apps scales on queue length.",
      basis: "inferred",
    },
    database: {
      value: "postgres",
      reason: "Emails, cases and approvals are relational; the outbox needs transactions.",
      basis: "inferred",
    },
    cache: {
      value: "yes",
      reason: "De-duplicates notifications by message id (Graph retries).",
      basis: "inferred",
    },
    messaging: {
      value: "queue",
      reason: "Retries and dead-lettering for each email; triage must never lose one (NFR-01).",
      basis: "stated",
    },
    exposure: {
      value: "internal",
      reason:
        "Only support agents use the console, over the corporate network; email arrives through Microsoft Graph.",
      basis: "stated",
    },
    topology: { value: "hub-spoke", reason: "Acme's landing zone is hub-and-spoke.", basis: "evidenced" },
    connectivity: {
      value: "private-circuit",
      reason: "The CRM is on-prem; ExpressRoute already exists.",
      basis: "evidenced",
    },
    identity: { value: "workforce", reason: "Support agents sign in with Entra ID.", basis: "stated" },
    classification: {
      value: "restricted",
      reason: "Emails carry personal and account data, sometimes card details in attachments.",
      basis: "stated",
    },
    compliance: {
      value: ["rbi", "iso27001"],
      reason: "RBI complaint timelines; ISO 27001 scope.",
      basis: "evidenced",
    },
    availability: {
      value: "zone-redundant",
      reason:
        "Email isn't lost while the listener is down (mailboxes keep it); zone redundancy meets NFR-01.",
      basis: "inferred",
    },
    ai: {
      value: "managed",
      reason: "Classification and drafting use Azure OpenAI through the AI CoE deployment.",
      basis: "stated",
    },
    observability: {
      value: "native",
      reason: "Telemetry goes to Azure Monitor and Sentinel.",
      basis: "evidenced",
    },
  },
};
