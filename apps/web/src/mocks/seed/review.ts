import type { Artifact, Finding } from "@throughline/contracts";

/** What a review pack is about. Lets each tenant get its own architecture/security artifacts. */
export type ReviewSubject = {
  packId: string;
  title: string;
  service: string;
  datastore: string;
  external: string;
  dataClasses: string;
  regulator: string;
  region: string;
};

/**
 * The artifact pack the review agents generate before G2. Each one is a real document the
 * architecture board and security reviewers sign off; findings must be resolved or accepted first.
 */
export function reviewArtifacts(s: ReviewSubject): Artifact[] {
  const id = (k: string) => `${s.packId}-${k}`;
  return [
    {
      id: id("arch"),
      kind: "architecture",
      status: "draft",
      generatedBy: "architect-agent · opus",
      summary: `How “${s.title}” fits into the existing estate, what changes and what stays.`,
      sections: [
        {
          heading: "Context",
          flow: [
            { name: "Mobile app", zone: "user" },
            { name: "API gateway", zone: "edge" },
            { name: s.service, zone: "app" },
            { name: "Event bus", zone: "app" },
            { name: s.datastore, zone: "data" },
            { name: s.external, zone: "external" },
          ],
        },
        {
          heading: "Key decisions",
          body: `Requests are recorded in an outbox and processed by a saga, so a slow or failing ${s.external} never blocks the customer. Every state change is written to the ledger with an idempotency key.`,
        },
        {
          heading: "Components that change",
          table: {
            columns: ["Component", "Change", "Owner"],
            rows: [
              [s.service, "New endpoint and saga", "Payments team"],
              ["Outbox table", "New", "Payments team"],
              [s.datastore, "New status column", "Data platform"],
              ["API gateway", "New route and rate limit", "Platform team"],
            ],
          },
        },
      ],
    },
    {
      id: id("adr"),
      kind: "adr",
      status: "draft",
      generatedBy: "architect-agent · opus",
      summary: "Decisions taken, options rejected and the reasons, in a format the board can sign.",
      sections: [
        {
          heading: "ADR · Use an outbox and saga",
          body: `Status: proposed. Context: ${s.external} can take up to 10 seconds and times out about 0.4% of the time. Decision: write the request to an outbox in the same transaction, then process it asynchronously. Consequences: the customer sees "pending" for up to 2 seconds; we gain retries without double-processing.`,
        },
        {
          heading: "Rejected options",
          table: {
            columns: ["Option", "Why rejected"],
            rows: [
              ["Direct synchronous call", "Couples customer latency to the external system; no safe retry"],
              ["Nightly batch", "Customers wait up to a day; fails the regulatory expectation"],
            ],
          },
        },
      ],
    },
    {
      id: id("threat"),
      kind: "threat-model",
      status: "draft",
      generatedBy: "security-agent · opus",
      summary: "STRIDE analysis of every trust boundary in the new flow.",
      sections: [
        {
          heading: "Threats by category",
          table: {
            columns: ["STRIDE", "Threat", "Likelihood", "Mitigation"],
            rows: [
              [
                "Spoofing",
                "Forged request from a stolen session",
                "Medium",
                "Step-up auth for the action; device binding",
              ],
              [
                "Tampering",
                "Replayed event changes the ledger twice",
                "High",
                "Idempotency key enforced in the ledger",
              ],
              [
                "Repudiation",
                "Customer disputes the action",
                "Medium",
                "Signed audit event with channel and device",
              ],
              ["Information disclosure", "Identifiers leak into logs", "Medium", "Structured log redaction"],
              [
                "Denial of service",
                `${s.external} slowdown fills the queue`,
                "Low",
                "Bounded queue, circuit breaker",
              ],
              [
                "Elevation of privilege",
                "Support tool reuses the endpoint",
                "Low",
                "Separate scope for staff tools",
              ],
            ],
          },
        },
      ],
    },
    {
      id: id("asvs"),
      kind: "security-review",
      status: "draft",
      generatedBy: "security-agent · opus",
      summary: "Checks against OWASP ASVS level 2 for the changed surface.",
      sections: [
        {
          heading: "Verification checklist",
          checks: [
            {
              label: "V2 Authentication · step-up for sensitive actions",
              state: "partial",
              note: "Step-up exists for payments, not yet for this action",
            },
            {
              label: "V4 Access control · object-level checks",
              state: "pass",
              note: "Ownership checked before every state change",
            },
            {
              label: "V5 Input validation · schema on every request",
              state: "pass",
              note: "Validated at the gateway and the service",
            },
            {
              label: "V7 Logging · no sensitive data in logs",
              state: "fail",
              note: "Account identifiers appear in two debug logs",
            },
            { label: "V8 Data protection · encryption at rest", state: "pass", note: "Customer-managed key" },
            {
              label: "V9 Communications · TLS 1.2+ everywhere",
              state: "pass",
              note: "mTLS between services",
            },
            {
              label: "V13 API · rate limiting",
              state: "partial",
              note: "Gateway limit set; per-customer limit missing",
            },
          ],
        },
      ],
    },
    {
      id: id("nfr"),
      kind: "nfr",
      status: "draft",
      generatedBy: "architect-agent · sonnet",
      summary: "Targets the change must meet, each tied to a test or a monitor.",
      sections: [
        {
          heading: "Targets",
          table: {
            columns: ["Quality", "Target", "How it's checked"],
            rows: [
              ["Latency", "p95 under 300 ms for the request", "Load test in Verify + SLO monitor"],
              ["Availability", "99.95% monthly", "Error budget in Operate"],
              ["Throughput", "200 requests/second peak", "Load test at 2× peak"],
              ["Recovery", "Resume within 5 minutes after a restart", "Chaos test"],
              ["Auditability", "Every change traceable for 7 years", "Audit retention policy"],
            ],
          },
        },
      ],
    },
    {
      id: id("dpia"),
      kind: "data-protection",
      status: "draft",
      generatedBy: "privacy-agent · sonnet",
      summary: `Personal data touched, lawful basis and retention under ${s.regulator}.`,
      sections: [
        {
          heading: "Personal data",
          table: {
            columns: ["Data", "Class", "Purpose", "Retention"],
            rows: [
              ["Customer id", "Internal", "Identify the customer", "Life of account"],
              ["Account reference", s.dataClasses, "Process the request", "7 years (regulatory)"],
              ["Device fingerprint", "Confidential", "Fraud checks", "90 days"],
            ],
          },
        },
        {
          heading: "Residency and transfers",
          body: `All data and model calls stay in ${s.region}. No new processors. Prompts sent to agents are redacted before leaving the tenant.`,
        },
      ],
    },
    {
      id: id("controls"),
      kind: "compliance-map",
      status: "draft",
      generatedBy: "compliance-agent · sonnet",
      summary: "Which controls this change touches and the evidence that will prove them.",
      sections: [
        {
          heading: "Control mapping",
          table: {
            columns: ["Control", "Requirement", "Evidence"],
            rows: [
              ["ISO 27001 A.8.28", "Secure coding", "Security review + SAST results on the PR"],
              ["ISO 27001 A.8.32", "Change management", "G1–G4 approvals in the audit trail"],
              ["SOC 2 CC8.1", "Authorised changes", "Two-person review at G3"],
              [s.regulator, "Customer can stop the instruction", "Acceptance tests for REQ-1 and REQ-3"],
            ],
          },
        },
      ],
    },
  ];
}

export function reviewFindings(packId: string, resolvedSecurity: boolean): Finding[] {
  return [
    {
      id: `${packId}-f1`,
      artifactId: `${packId}-asvs`,
      severity: "high",
      title: "Account identifiers written to debug logs",
      detail: "Two debug statements log the full account reference. Redact or remove before release.",
      status: resolvedSecurity ? "resolved" : "open",
      resolvedBy: resolvedSecurity ? "Arjun S." : null,
    },
    {
      id: `${packId}-f2`,
      artifactId: `${packId}-threat`,
      severity: "high",
      title: "Replay could double-apply a ledger change",
      detail:
        "Idempotency key is generated but not yet enforced by the ledger write. Add a unique constraint.",
      status: "open",
      resolvedBy: null,
    },
    {
      id: `${packId}-f3`,
      artifactId: `${packId}-asvs`,
      severity: "medium",
      title: "No per-customer rate limit",
      detail: "Gateway limit protects the service, but one customer can still flood the queue.",
      status: "open",
      resolvedBy: null,
    },
    {
      id: `${packId}-f4`,
      artifactId: `${packId}-nfr`,
      severity: "low",
      title: "Recovery target not yet covered by a test",
      detail: "Add a chaos test for restart recovery before Release.",
      status: "open",
      resolvedBy: null,
    },
  ];
}
