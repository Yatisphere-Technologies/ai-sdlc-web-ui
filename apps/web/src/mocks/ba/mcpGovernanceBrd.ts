import type { BrdContent, BrdThread } from "@throughline/contracts";
import type { StoryHint } from "./types";

/**
 * BRD-52: governing how Acme's AI agents use tools through the Model Context Protocol (MCP). The
 * architecture INT-52 is derived from this BRD; BRD-40's email listener depends on the platform.
 * Product facts (GA/preview) were checked on 25 Oct 2026.
 */
export const mcpGovernanceBrdContent: BrdContent = {
  summary:
    "Acme has more than 120 AI agents in pilots and production (Foundry, Copilot Studio and in-house), and they increasingly call tools through MCP servers: some built by Acme teams, some hosted by vendors such as GitHub, Atlassian and ServiceNow, and some from open source. Today each team wires its own servers with its own credentials, so nobody can say which agent called which tool for whom, and a poisoned tool description or a leaked token would go unnoticed. This BRD defines one governed path for every tool call: servers are approved and registered before use, every call carries the agent's own identity and the user it acts for, tool arguments and results are screened for prompt injection, and every call is recorded for audit and incident response.",
  problem:
    "MCP adoption is outpacing control. An inventory in October 2026 found 41 MCP servers in use across 9 teams, 17 of them unregistered, 23 using long-lived personal access tokens or shared API keys, and none with a record of which tools were called. Security cannot block a compromised server quickly, compliance cannot evidence who accessed customer data through an agent, and the BRD-40 email listener cannot go live until its tool calls are governed.",
  background:
    "Microsoft made Entra Agent ID generally available in April 2026, and Azure API Management (classic and v2 tiers) can expose and govern MCP servers; content-safety policies on MCP traffic were announced as GA at Build 2026, and API Center provides a private registry with an MCP endpoint. Agent 365 governance of API Management and the dedicated AI Gateway tier are in preview. The MCP specification version 2026-07-28 removed sessions, added Mcp-Method and Mcp-Name headers and deprecated dynamic client registration. Acme's AI CoE framework requires a named sponsor, kill switch and audit trail for every agent.",
  objectives: [
    {
      id: "OBJ-1",
      statement: "Every agent tool call is governed and attributable",
      kpi: "Share of production tool calls that pass through the governed gateway with an agent identity",
      baseline: "0%",
      target: "100% of production calls by the end of the rollout",
    },
    {
      id: "OBJ-2",
      statement: "No unapproved MCP server is reachable by an agent",
      kpi: "Unregistered MCP servers in use",
      baseline: "17",
      target: "0, verified by monthly discovery scans",
    },
    {
      id: "OBJ-3",
      statement: "Respond to a compromised server or tool within minutes",
      kpi: "Time to block a server for all agents",
      baseline: "Not possible today",
      target: "≤ 15 minutes from decision to block",
    },
    {
      id: "OBJ-4",
      statement: "Make onboarding a governed server faster than going around the process",
      kpi: "Median time from request to an approved, published server",
      baseline: "No process",
      target: "≤ 10 working days for tier 1 and 2 servers",
    },
  ],
  inScope: [
    "All MCP servers used by Acme agents: first-party, vendor-hosted and open-source",
    "Agents built in Foundry, Copilot Studio and in-house runtimes, plus developer tools (VS Code, GitHub Copilot)",
    "Server onboarding, registry, gateway enforcement, agent identity, monitoring and retirement",
    "Production and pre-production environments in India regions",
  ],
  outOfScope: [
    "Governance of model endpoints themselves (covered by the AI CoE model gateway)",
    "MCP resources and prompts (the gateway governs tools only today)",
    "Agents run by third parties outside Acme's tenant",
  ],
  stakeholders: [
    {
      name: "Sanjay Menon",
      role: "COO · business sponsor",
      raci: "A",
      interest: "Agents scale safely without slowing teams",
    },
    {
      name: "Arjun Shah",
      role: "CISO",
      raci: "R",
      interest: "Attribution, kill switch and detection for agent activity",
    },
    { name: "Neha Gupta", role: "AI CoE lead", raci: "R", interest: "One pattern every agent team follows" },
    {
      name: "Meera Iyer",
      role: "Head of compliance",
      raci: "C",
      interest: "Evidence of who accessed customer data, retained per RBI",
    },
    {
      name: "Kavita Rao",
      role: "Support operations (BRD-40 owner)",
      raci: "C",
      interest: "Email listener can go live on governed tools",
    },
    {
      name: "Platform engineering",
      role: "Builds and runs the gateway",
      raci: "R",
      interest: "Operable, automated, no manual policy edits",
    },
    {
      name: "Agent teams",
      role: "Consume the platform",
      raci: "I",
      interest: "Fast onboarding and clear rules",
    },
  ],
  currentState: [
    { actor: "Agent team", step: "Finds an MCP server and adds its URL to the agent configuration" },
    {
      actor: "Agent team",
      step: "Creates a personal access token or API key and stores it in the agent's settings",
    },
    { actor: "Agent", step: "Calls the server directly over the internet with the shared credential" },
    {
      actor: "Security",
      step: "Has no inventory, no logs of tool calls and no way to block a server centrally",
    },
  ],
  painPoints: [
    "No inventory: 17 of 41 servers in use were unknown to security",
    "Shared, long-lived credentials: one leaked token exposes every user's data",
    "No attribution: logs show a service account, not which agent acted for which user",
    "No screening: tool descriptions and results can carry injected instructions to the model",
    "No kill switch: blocking a server means editing every agent",
  ],
  futureState: [
    {
      actor: "Agent team",
      step: "Requests a server in the governance portal with owner, tools and data touched",
    },
    {
      actor: "Security and architecture",
      step: "Review the tools and assign a trust tier; approve or reject",
    },
    {
      actor: "Platform",
      step: "Registers the server in API Center and publishes it through the gateway with the standard policy",
    },
    {
      actor: "Agent",
      step: "Calls the gateway with its Entra Agent ID token; the gateway checks it, screens arguments and results, and calls the server with its own credential",
    },
    {
      actor: "Gateway",
      step: "Records every call with agent, user, tool and verdict; Sentinel alerts on anomalies",
    },
    { actor: "Security", step: "Blocks a server or tool for every agent in one action when needed" },
  ],
  requirements: [
    {
      id: "BR-01",
      title: "Single governed entry point",
      statement:
        "The platform shall route every production agent tool call through one governed gateway per region.",
      rationale: "Controls that live in each server are inconsistent and can be bypassed.",
      priority: "must",
      area: "Gateway enforcement",
      actor: "Agent",
      objective: "OBJ-1",
      source: "CISO workshop, 8 Oct 2026",
      acceptance: [
        "Given an agent in production, when it calls a tool, then the call reaches the server only through the gateway",
        "Given a direct call to a server's endpoint from an agent network, then it is refused at the network layer",
      ],
    },
    {
      id: "BR-02",
      title: "Agent identity on every call",
      statement:
        "The platform shall accept a tool call only when it carries a token for a registered agent identity with a named human sponsor.",
      rationale: "Attribution and Conditional Access need a real identity per agent, not shared keys.",
      priority: "must",
      area: "Identity and access",
      actor: "Agent",
      objective: "OBJ-1",
      source: "AI CoE framework v2",
      acceptance: [
        "Given a token for an unregistered or sponsorless agent, when it calls a tool, then the gateway returns 401",
        "Given a delegated call, then the record shows both the agent and the user it acts for",
      ],
    },
    {
      id: "BR-03",
      title: "No token passthrough",
      statement:
        "The platform shall never forward an agent's or user's token to an MCP server; servers receive a credential issued for the gateway.",
      rationale: "Required by the MCP authorization specification; prevents confused-deputy attacks.",
      priority: "must",
      area: "Identity and access",
      actor: "Gateway",
      objective: "OBJ-1",
      source: "MCP authorization specification",
      acceptance: [
        "Given any tool call, then the request reaching the server carries the gateway's credential and not the caller's token",
      ],
    },
    {
      id: "BR-04",
      title: "Registered servers only",
      statement:
        "The platform shall make an MCP server reachable only after it is approved and registered with an owner, trust tier, data classification and allowed tools.",
      rationale: "Stops shadow servers and gives security an inventory.",
      priority: "must",
      area: "Registry and onboarding",
      actor: "Platform engineering",
      objective: "OBJ-2",
      source: "MCP inventory, Oct 2026",
      acceptance: [
        "Given a server that is not in the registry, when an agent calls it through the gateway, then the call is refused",
        "Given a registered server, then its record shows owner, tier, classification and allowed tools",
      ],
    },
    {
      id: "BR-05",
      title: "Tool allow-list per server",
      statement:
        "The platform shall allow only the tools approved for each server and refuse any other tool name.",
      rationale: "A server can add tools after approval; unapproved tools must not run.",
      priority: "must",
      area: "Gateway enforcement",
      actor: "Gateway",
      objective: "OBJ-2",
      source: "OWASP MCP Top 10 (MCP03)",
      acceptance: [
        "Given a tools/call for a tool not on the allow-list, then the gateway returns a JSON-RPC error and records it",
      ],
    },
    {
      id: "BR-06",
      title: "Prompt-injection screening",
      statement:
        "The platform shall screen tool arguments and tool results for prompt injection and harmful content before they reach the server or the model.",
      rationale: "Injected instructions usually arrive in tool output, not in the user's prompt.",
      priority: "must",
      area: "Gateway enforcement",
      actor: "Gateway",
      objective: "OBJ-1",
      source: "OWASP MCP Top 10 (MCP06)",
      acceptance: [
        "Given a tool result containing a known injection pattern, then it is blocked and the verdict recorded",
        "Given screening is unavailable, then the call is refused rather than passed through",
      ],
    },
    {
      id: "BR-07",
      title: "Central kill switch",
      statement:
        "The platform shall let authorised security staff block a server or a tool for every agent in one action.",
      rationale: "Incident response cannot depend on editing every agent.",
      priority: "must",
      area: "Operations and response",
      actor: "Security operations",
      objective: "OBJ-3",
      source: "CISO workshop, 8 Oct 2026",
      acceptance: [
        "Given a blocked server, when any agent calls it, then the gateway returns 403 within 15 minutes of the block",
        "Given a block, then it is recorded with who, when and why, and reconciled into configuration within 24 hours",
      ],
    },
    {
      id: "BR-08",
      title: "Complete audit trail",
      statement:
        "The platform shall record every tool call with agent, user, server, tool, verdict, latency and correlation id, and retain it per policy.",
      rationale: "Compliance must evidence who accessed customer data through an agent.",
      priority: "must",
      area: "Audit and monitoring",
      actor: "Gateway",
      objective: "OBJ-1",
      source: "Compliance note, Oct 2026",
      acceptance: [
        "Given any tool call, then one audit record exists with all listed fields",
        "Given a record older than 90 days, then it is in the archive and retrievable for the retention period",
      ],
    },
    {
      id: "BR-09",
      title: "Tool drift detection",
      statement:
        "The platform shall compare each server's live tool list with the registry daily and alert when it changes.",
      rationale: "Detects tool poisoning and silent changes by vendors.",
      priority: "should",
      area: "Audit and monitoring",
      actor: "Tool-call auditor",
      objective: "OBJ-2",
      source: "OWASP MCP Top 10 (MCP03)",
      acceptance: [
        "Given a server whose tools/list differs from its registry entry, then an alert reaches security on-call within 24 hours",
      ],
    },
    {
      id: "BR-10",
      title: "Self-service onboarding",
      statement:
        "The platform shall let agent teams request a server, track review and receive access through a portal with defined review steps per trust tier.",
      rationale: "If governance is slower than going around it, teams will go around it.",
      priority: "should",
      area: "Registry and onboarding",
      actor: "Agent team",
      objective: "OBJ-4",
      source: "AI CoE team survey",
      acceptance: [
        "Given a tier 1 or 2 request, then the median time to approval is 10 working days or less over a quarter",
        "Given an approved request, then access is granted through an access package with an expiry date",
      ],
    },
    {
      id: "BR-11",
      title: "Rate limits per agent",
      statement:
        "The platform shall limit call rates per agent and user, with lower limits for tools that change data.",
      rationale: "Stops runaway agent loops from overloading shared systems.",
      priority: "should",
      area: "Gateway enforcement",
      actor: "Gateway",
      objective: "OBJ-1",
      source: "Platform engineering",
      acceptance: ["Given an agent above its limit, then further calls get 429 until the window resets"],
    },
    {
      id: "BR-12",
      title: "Registry-only developer tools",
      statement:
        "The platform shall configure VS Code and GitHub Copilot to use only servers listed in the registry.",
      rationale: "Developers are the largest source of unregistered servers.",
      priority: "could",
      area: "Registry and onboarding",
      actor: "Developer",
      objective: "OBJ-2",
      source: "MCP inventory, Oct 2026",
      acceptance: [
        "Given a developer adds an unlisted server in VS Code, then the IDE refuses it under the enterprise policy",
      ],
    },
    {
      id: "BR-13",
      title: "Govern MCP resources and prompts",
      statement: "The platform shall govern MCP resources and prompts as well as tools.",
      rationale: "Not supported by the gateway today; revisit when it is.",
      priority: "wont",
      area: "Gateway enforcement",
      actor: "Gateway",
      objective: "OBJ-1",
      source: "Architecture review",
      acceptance: ["Deferred until the gateway supports resources and prompts"],
    },
  ],
  rules: [
    {
      id: "RULE-01",
      statement: "Read and write tools of the same server are published as separate gateway APIs.",
      source: "Architecture review",
    },
    {
      id: "RULE-02",
      statement:
        "Community (tier 3) servers run only as re-hosted, pinned, scanned images and only with read-only tools.",
      source: "CISO workshop",
    },
    {
      id: "RULE-03",
      statement: "Access to a server is granted through an access package that expires within 180 days.",
      source: "Identity governance standard",
    },
    {
      id: "RULE-04",
      statement: "Preview platform features may be used only in the pilot subscription.",
      source: "Cloud policy CP-12",
    },
    {
      id: "RULE-05",
      statement:
        "Policy, API and registry changes go through pull requests with two approvers; emergency blocks are the only manual change.",
      source: "Change management standard",
    },
  ],
  nfrs: [
    {
      id: "NFR-01",
      category: "security",
      statement: "Tokens are validated for issuer, signature, expiry and audience equal to the server's URI",
      target: "100% of calls",
    },
    {
      id: "NFR-02",
      category: "availability",
      statement: "Gateway availability in the primary region, with a warm standby region",
      target: "99.95% monthly; RTO 1 h; RPO 15 min",
    },
    {
      id: "NFR-03",
      category: "performance",
      statement: "Latency the gateway adds to a tool call, excluding content screening",
      target: "p95 ≤ 150 ms",
    },
    {
      id: "NFR-04",
      category: "compliance",
      statement: "Tool-call records retained for regulated audit",
      target: "90 days searchable; 8 years archived",
    },
    {
      id: "NFR-05",
      category: "data",
      statement: "Gateway, servers, screening and logs stay in India regions",
      target: "No tool-call data leaves India",
    },
    {
      id: "NFR-06",
      category: "security",
      statement: "Fail closed when authentication, policy or screening cannot run",
      target: "0 calls passed unscreened",
    },
    {
      id: "NFR-07",
      category: "reporting",
      statement: "Usage, blocks and screening verdicts per agent and server",
      target: "Dashboards refreshed within 5 minutes",
    },
  ],
  data: [
    {
      entity: "MCP server registry entry",
      description: "Server, owner, trust tier, classification, allowed tools, version",
      classification: "internal",
      retention: "Life of server + 2 years",
    },
    {
      entity: "Tool-call record",
      description: "Agent id, user id, server, tool, verdict, latency, correlation id",
      classification: "confidential",
      retention: "90 days searchable, 8 years archived",
    },
    {
      entity: "Tool arguments and results",
      description: "Payloads captured only for servers that need them",
      classification: "restricted",
      retention: "Per data class; off by default",
    },
    {
      entity: "Onboarding request",
      description: "Request, reviews, approvals and decisions",
      classification: "internal",
      retention: "7 years",
    },
    {
      entity: "Agent identity",
      description: "Agent ID, blueprint, sponsor, access packages",
      classification: "internal",
      retention: "Life of agent + 1 year",
    },
  ],
  assumptions: [
    "API Management Premium v2 and Azure AI Content Safety are available in an India region, or an approved exception exists",
    "All agent runtimes in scope can send an Entra Agent ID token",
    "Vendor MCP servers support OAuth so the gateway can hold per-user credentials",
  ],
  constraints: [
    "The gateway governs MCP tools only, not resources or prompts",
    "API Management policies apply per server, not per tool, outside the preview AI Gateway tier",
    "API Management v2 tiers have no multi-region deployment; disaster recovery needs a second instance",
  ],
  dependencies: [
    "Entra Agent ID licences and blueprints for every agent",
    "ExpressRoute to on-prem systems wrapped by first-party servers",
    "BRD-40 (email listener) is the first production consumer",
  ],
  risks: [
    {
      id: "RISK-01",
      description: "Content screening or Premium v2 is not available in an India region",
      impact: "high",
      likelihood: "medium",
      mitigation: "Confirm before G2; hold go-live until resolved",
      owner: "Architecture lead",
    },
    {
      id: "RISK-02",
      description: "Teams bypass the gateway by calling servers directly",
      impact: "high",
      likelihood: "medium",
      mitigation: "Servers have no public endpoint and accept only the gateway identity",
      owner: "Network team",
    },
    {
      id: "RISK-03",
      description: "Onboarding is too slow and teams resist",
      impact: "medium",
      likelihood: "medium",
      mitigation: "Tiered review with a 10-day target; measure monthly",
      owner: "AI CoE lead",
    },
    {
      id: "RISK-04",
      description: "Agent runtimes skip human approval on high-impact tools",
      impact: "high",
      likelihood: "low",
      mitigation: "Approval enforced in the runtime plus stricter write-tool policy at the gateway",
      owner: "Agent owners",
    },
  ],
  successCriteria: [
    "All production agents call tools only through the gateway",
    "A server can be blocked for every agent in under 15 minutes",
    "Compliance can answer 'which agent accessed this customer's data, for whom' from one query",
  ],
  glossary: [
    {
      term: "MCP",
      definition: "Model Context Protocol: an open protocol for agents to discover and call tools",
    },
    {
      term: "Agent ID",
      definition: "Microsoft Entra Agent ID: an identity for an AI agent with a human sponsor",
    },
    { term: "Trust tier", definition: "1 first-party, 2 vendor-hosted under contract, 3 community" },
  ],
  openQuestions: [
    {
      id: "OQ-1",
      question: "Which tools need human approval, and who approves outside office hours?",
      owner: "Neha Gupta",
      status: "open",
    },
    {
      id: "OQ-2",
      question: "Is Content Safety available in Central India for MCP screening?",
      owner: "Architecture lead",
      status: "resolved",
      answer: "Yes for Central India; confirmed with Microsoft on 21 Oct 2026.",
    },
    {
      id: "OQ-3",
      question: "Retention for raw payloads per data class",
      owner: "Meera Iyer",
      status: "open",
    },
  ],
};

/** Refinement notes the backlog uses for key requirements. */
export const mcpGovernanceHints: Record<string, StoryHint[]> = {};

export function mcpGovernanceThread(): BrdThread {
  return {
    brdId: "BRD-52",
    agent: "simulated",
    autoApply: true,
    step: null,
    skipped: [],
    focus: null,
    messages: [
      {
        id: "M1",
        role: "user",
        at: "2026-10-08T09:00:00Z",
        text: "I need a BRD for governing how our agents use MCP tools. Start from the CISO workshop notes and the MCP inventory.",
        cites: [],
        proposals: [],
        suggestions: [],
      },
      {
        id: "M2",
        role: "agent",
        at: "2026-10-08T09:01:00Z",
        text: "Drafted 13 requirements across gateway enforcement, identity, registry, monitoring and response, with 7 NFRs. BR-13 (resources and prompts) is marked Won't because the gateway supports tools only today. The architecture (INT-52) is derived from version 1.0.",
        cites: [],
        proposals: [],
        suggestions: [],
      },
    ],
  };
}
