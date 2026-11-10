import type { BrdContent } from "@throughline/contracts";
import type { StoryHint } from "./types";

export const northwindBrdContent: BrdContent = {
  summary:
    "SWIFT's MT/ISO 20022 coexistence period for cross-border payments ended in November 2025, and CBUAE is moving UAEFTS to ISO 20022. Northwind must accept corporate payment instructions, produce valid pacs.008 messages, and keep core banking postings and customer status in step, without changing how corporate clients submit payments.",
  problem:
    "Payments are still built as MT103 and translated by a vendor gateway that truncates structured data. Around 3% of outbound payments are repaired by hand and several correspondents now reject messages with incomplete party data.",
  background:
    "Corporate clients submit 40,000 instructions a day through the corporate portal and host-to-host files. Payments operations repair rejected messages in the vendor tool.",
  objectives: [
    {
      id: "OBJ-1",
      statement: "Send fully structured ISO 20022 payments",
      kpi: "Share of outbound payments sent as native pacs.008 with structured party data",
      baseline: "0%",
      target: "100% by go-live",
    },
    {
      id: "OBJ-2",
      statement: "Cut manual repairs",
      kpi: "Payments repaired by hand",
      baseline: "3.1% of volume",
      target: "< 0.5% of volume",
    },
    {
      id: "OBJ-3",
      statement: "Keep clients informed",
      kpi: "Payments with a status visible to the client within 5 minutes",
      baseline: "62%",
      target: "≥ 98%",
    },
  ],
  inScope: [
    "Building pacs.008 for cross-border (SWIFT) and domestic (UAEFTS) credit transfers",
    "Validation of structured party and address data before submission",
    "Core banking debit posting and status updates to the corporate portal",
    "Repair queue for payments operations",
  ],
  outOfScope: [
    "Inbound pacs.008 processing (phase 2)",
    "Cheque and cash payments",
    "Changes to host-to-host file formats",
  ],
  stakeholders: [
    {
      name: "Fatima Al Mansoori",
      role: "Head of Transaction Banking (sponsor)",
      raci: "A",
      interest: "Client experience and SWIFT compliance",
    },
    {
      name: "Omar Haddad",
      role: "Product owner, Payments hub",
      raci: "R",
      interest: "Delivery and adoption",
    },
    {
      name: "Priya Nair",
      role: "Solution architect",
      raci: "C",
      interest: "Architecture fit and resilience",
    },
    { name: "Layla Saeed", role: "Compliance", raci: "C", interest: "CBUAE and sanctions obligations" },
    { name: "Payments operations", role: "Operations", raci: "C", interest: "Repair effort" },
  ],
  currentState: [
    { actor: "Corporate client", step: "Submits a payment in the portal" },
    { actor: "Payments hub", step: "Builds an MT103" },
    { actor: "Vendor gateway", step: "Translates MT103 to pacs.008, losing structured data" },
    { actor: "Operations", step: "Repairs rejected messages by hand" },
  ],
  painPoints: [
    "Truncated party data causes rejections",
    "Manual repairs delay payments",
    "Clients can't see status",
  ],
  futureState: [
    { actor: "Corporate client", step: "Submits a payment exactly as today" },
    { actor: "Payments hub", step: "Validates and builds a native pacs.008" },
    { actor: "Payments hub", step: "Debits the account in core banking and routes to SWIFT or UAEFTS" },
    { actor: "Corporate client", step: "Sees status updates in the portal" },
  ],
  requirements: [
    {
      id: "BR-01",
      title: "Build native pacs.008",
      statement:
        "The hub shall create a pacs.008 message for every outbound credit transfer, with structured debtor, creditor and agent data.",
      rationale: "Required by SWIFT and CBUAE; removes truncation.",
      priority: "must",
      area: "Message creation",
      actor: "Payments hub",
      objective: "OBJ-1",
      source: "SWIFT ISO 20022 programme; CBUAE notice",
      acceptance: [
        "Every outbound payment produces a schema-valid pacs.008",
        "Party names and addresses are sent in structured fields",
      ],
    },
    {
      id: "BR-02",
      title: "Validate before sending",
      statement:
        "Payments with missing or invalid structured data shall be stopped before submission and the client told what to fix.",
      rationale: "Prevents correspondent rejections.",
      priority: "must",
      area: "Message creation",
      actor: "Corporate client",
      objective: "OBJ-2",
      source: "Operations repair analysis",
      acceptance: [
        "Invalid payments are rejected within 10 seconds with a field-level reason",
        "Valid payments are never blocked by validation",
      ],
    },
    {
      id: "BR-03",
      title: "Debit the account in core banking",
      statement: "The hub shall debit the client account in core banking before routing the payment.",
      rationale: "Avoids sending unfunded payments.",
      priority: "must",
      area: "Core banking",
      actor: "Payments hub",
      objective: "OBJ-1",
      source: "Treasury operations",
      acceptance: [
        "No payment is routed without a successful debit",
        "A failed debit stops the payment and notifies the client",
      ],
    },
    {
      id: "BR-04",
      title: "Route to SWIFT or UAEFTS",
      statement: "The hub shall route each payment to SWIFT or UAEFTS by currency and destination.",
      rationale: "Domestic AED payments clear on UAEFTS.",
      priority: "must",
      area: "Routing",
      actor: "Payments hub",
      objective: "OBJ-1",
      source: "Payments product rules",
      acceptance: ["AED payments to UAE banks go to UAEFTS", "All other payments go to SWIFT"],
    },
    {
      id: "BR-05",
      title: "Client payment status",
      statement: "Clients shall see the status of each payment in the corporate portal.",
      rationale: "Cuts status enquiries to relationship managers.",
      priority: "should",
      area: "Client experience",
      actor: "Corporate client",
      objective: "OBJ-3",
      source: "Client advisory board",
      acceptance: [
        "Status changes appear in the portal within 5 minutes",
        "Rejected payments show the reason",
      ],
    },
    {
      id: "BR-06",
      title: "Repair queue",
      statement:
        "Operations shall repair or reject payments stopped by downstream checks from a single queue.",
      rationale: "Replaces the vendor tool.",
      priority: "should",
      area: "Operations",
      actor: "Operations analyst",
      objective: "OBJ-2",
      source: "Operations workshop",
      acceptance: [
        "Every stopped payment is in the queue within 2 minutes",
        "Repairs need a second person to approve (four eyes)",
      ],
    },
  ],
  rules: [
    {
      id: "RULE-01",
      statement: "Payments over AED 1,000,000 need a second approver in the portal.",
      source: "Northwind payments policy",
    },
    {
      id: "RULE-02",
      statement: "Sanctions screening must pass before routing.",
      source: "CBUAE AML/CFT requirements",
    },
  ],
  nfrs: [
    {
      id: "NFR-01",
      category: "availability",
      statement: "Hub available during banking hours",
      target: "99.99% between 06:00–22:00 GST",
    },
    {
      id: "NFR-02",
      category: "performance",
      statement: "Acknowledge an instruction",
      target: "800 ms at p95 at 300 payments/s",
    },
    {
      id: "NFR-03",
      category: "security",
      statement: "Keys held in a dedicated HSM",
      target: "100% of signing keys",
    },
    {
      id: "NFR-04",
      category: "compliance",
      statement: "Payment data stays in the UAE",
      target: "0 records outside the UAE",
    },
  ],
  data: [
    {
      entity: "Payment instruction",
      description: "Client instruction and ISO message",
      classification: "restricted",
      retention: "10 years",
    },
    {
      entity: "Status event",
      description: "Lifecycle status updates",
      classification: "confidential",
      retention: "10 years",
    },
  ],
  assumptions: [
    "Correspondents accept structured addresses from go-live",
    "Core banking debit API supports idempotency keys",
  ],
  constraints: ["Corporate clients see no change to submission", "Go-live before the CBUAE cut-over date"],
  dependencies: ["SWIFT Alliance Access upgrade", "UAEFTS ISO 20022 test window"],
  risks: [
    {
      id: "R-1",
      description: "Clients send unstructured addresses",
      impact: "high",
      likelihood: "high",
      mitigation: "Address parsing assistant plus client outreach",
      owner: "Omar Haddad",
    },
    {
      id: "R-2",
      description: "UAEFTS test window moves",
      impact: "medium",
      likelihood: "medium",
      mitigation: "Simulator-based testing",
      owner: "Omar Haddad",
    },
  ],
  successCriteria: ["All outbound payments sent as native pacs.008", "Repairs under 0.5% for 30 days"],
  glossary: [
    { term: "pacs.008", definition: "ISO 20022 FI-to-FI customer credit transfer message" },
    { term: "UAEFTS", definition: "UAE Funds Transfer System operated by CBUAE" },
  ],
  openQuestions: [
    {
      id: "OQ-1",
      question: "Do we support hybrid addresses at go-live?",
      owner: "Layla Saeed",
      status: "resolved",
      answer: "Yes, until the market deadline.",
    },
  ],
};

export const northwindHints: Record<string, StoryHint[]> = {
  "BR-01": [
    {
      title: "Map instructions to pacs.008",
      asA: "payments hub",
      iWant: "to build a schema-valid pacs.008 from each instruction",
      soThat: "correspondents receive complete structured data",
      criteria: [
        ["a valid instruction", "the hub builds the message", "it validates against the pacs.008 schema"],
      ],
      points: 8,
      components: ["iso-builder"],
    },
    {
      title: "Send structured party addresses",
      asA: "payments hub",
      iWant: "names and addresses in structured fields",
      soThat: "nothing is truncated",
      criteria: [
        ["a client address with town and country", "the message is built", "TwnNm and Ctry are populated"],
      ],
      points: 5,
      components: ["iso-builder"],
    },
  ],
  "BR-02": [
    {
      title: "Field-level validation feedback",
      asA: "corporate client",
      iWant: "to know exactly which field is wrong",
      soThat: "I can fix and resubmit quickly",
      criteria: [
        ["a payment missing the creditor town", "I submit", "I see the field and reason within 10 seconds"],
      ],
      points: 5,
      components: ["validation", "portal"],
    },
  ],
  "BR-03": [
    {
      title: "Debit before routing",
      asA: "payments hub",
      iWant: "to debit the account in core banking before routing",
      soThat: "we never send unfunded payments",
      criteria: [
        ["a validated payment", "the debit succeeds", "the payment is routed"],
        ["a validated payment", "the debit fails", "the payment stops and the client is notified"],
      ],
      points: 8,
      components: ["core-adapter"],
    },
  ],
  "BR-04": [
    {
      title: "Route AED domestic payments to UAEFTS",
      asA: "payments hub",
      iWant: "AED payments to UAE banks routed to UAEFTS",
      soThat: "they clear domestically",
      criteria: [["an AED payment to a UAE bank", "it is routed", "it goes to UAEFTS"]],
      points: 3,
      components: ["router"],
    },
    {
      title: "Route other payments to SWIFT",
      asA: "payments hub",
      iWant: "all other payments routed to SWIFT",
      soThat: "cross-border payments settle",
      criteria: [["a USD payment abroad", "it is routed", "it goes to SWIFT via Alliance Access"]],
      points: 3,
      components: ["router", "swift-adapter"],
    },
  ],
  "BR-05": [
    {
      title: "Payment status in the portal",
      asA: "corporate client",
      iWant: "to see each payment's status",
      soThat: "I don't need to call my relationship manager",
      criteria: [["a payment I submitted", "its status changes", "the portal shows it within 5 minutes"]],
      points: 5,
      components: ["portal", "status-feed"],
    },
  ],
};

/** Fabrikam's draft: deliberately unfinished, so the quality checks have something to say. */
export const fabrikamBrdContent: BrdContent = {
  summary: "Expire loyalty points that are older than 24 months and remind shoppers before it happens.",
  problem:
    "Unexpired points sit on the balance sheet as a liability of about $4.2M, and shoppers complain when points vanish without warning.",
  background: "Points never expire today. Finance asked for a 24-month expiry from 1 April 2027.",
  objectives: [
    {
      id: "OBJ-1",
      statement: "Reduce loyalty liability",
      kpi: "Outstanding points liability",
      baseline: "$4.2M",
      target: "$2.5M by end of FY27",
    },
    {
      id: "OBJ-2",
      statement: "Keep shoppers happy",
      kpi: "Complaints about expired points",
      baseline: "n/a",
      target: "low",
    },
  ],
  inScope: [
    "Expiry of points older than 24 months",
    "Reminder emails 30 and 7 days before expiry",
    "Balance shown with expiry dates",
  ],
  outOfScope: [],
  stakeholders: [
    { name: "Dana Whitfield", role: "Loyalty product manager", raci: "R", interest: "Shopper experience" },
    { name: "Finance", role: "Finance", raci: "C", interest: "Liability reduction" },
  ],
  currentState: [{ actor: "Shopper", step: "Earns points that never expire" }],
  painPoints: ["Growing liability"],
  futureState: [{ actor: "System", step: "Expires old points nightly and reminds shoppers first" }],
  requirements: [
    {
      id: "BR-01",
      title: "Expire old points",
      statement: "Points older than 24 months shall expire nightly.",
      rationale: "Finance policy.",
      priority: "must",
      area: "Expiry",
      actor: "System",
      objective: "OBJ-1",
      source: "Finance",
      acceptance: ["Points earned more than 24 months ago are removed in the nightly run"],
    },
    {
      id: "BR-02",
      title: "Remind shoppers",
      statement:
        "Shoppers shall get reminders before points expire, sent quickly and in a user-friendly way.",
      rationale: "Fewer complaints.",
      priority: "must",
      area: "Communication",
      actor: "Shopper",
      objective: "OBJ-2",
      source: "",
      acceptance: ["Reminders are sent as soon as possible"],
    },
    {
      id: "BR-03",
      title: "Show expiry dates",
      statement: "The balance page shall show which points expire and when.",
      rationale: "Transparency.",
      priority: "should",
      area: "Communication",
      actor: "Shopper",
      objective: "OBJ-2",
      source: "Customer research",
      acceptance: [],
    },
  ],
  rules: [{ id: "RULE-01", statement: "Oldest points are spent first.", source: "Loyalty terms" }],
  nfrs: [
    {
      id: "NFR-01",
      category: "performance",
      statement: "Nightly run finishes before stores open",
      target: "fast",
    },
  ],
  data: [
    {
      entity: "Points ledger",
      description: "Earn and burn entries",
      classification: "confidential",
      retention: "3 years",
    },
  ],
  assumptions: ["Email consent exists for 80% of shoppers"],
  constraints: ["Live by 1 April 2027"],
  dependencies: ["Email provider templates"],
  risks: [
    {
      id: "R-1",
      description: "Backlash on social media",
      impact: "medium",
      likelihood: "medium",
      mitigation: "",
      owner: "Dana Whitfield",
    },
  ],
  successCriteria: ["Liability target met"],
  glossary: [],
  openQuestions: [
    {
      id: "OQ-1",
      question: "Do points earned in-store and online expire the same way?",
      owner: "Dana Whitfield",
      status: "open",
    },
    {
      id: "OQ-2",
      question: "Is California law compatible with expiring points?",
      owner: "Legal",
      status: "open",
    },
  ],
};
