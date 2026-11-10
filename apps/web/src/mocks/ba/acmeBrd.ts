import type { BrdContent } from "@throughline/contracts";
import type { StoryHint } from "./types";

export const acmeBrdContent: BrdContent = {
  summary:
    "Customers cannot cancel UPI AutoPay mandates themselves today, so they call support and keep being debited for days while operations email the PSP. This BRD defines self-service cancellation in the Acme app, automatic revocation with the PSP, an end to future debits in the core ledger, customer notifications and an exception queue for operations, with a complete audit trail.",
  problem:
    "Cancelling a UPI AutoPay mandate takes 2–5 working days and three manual hand-offs (support → operations → PSP). During that time customers are still debited, which drives about 2,400 complaints a month, chargeback disputes and regulatory exposure.",
  background:
    "AutoPay mandates grew 4× in the last year to 9 million active mandates. NPCI rules require that customers can revoke a mandate at any time. The current process predates that volume and relies on email and a shared spreadsheet.",
  objectives: [
    {
      id: "OBJ-1",
      statement: "Stop unwanted debits after a customer asks to cancel",
      kpi: "Complaints about debits after a cancellation request, per month",
      baseline: "2,400 / month",
      target: "≤ 500 / month within 90 days of launch",
    },
    {
      id: "OBJ-2",
      statement: "Revoke mandates with the PSP within the agreed window",
      kpi: "Share of revocations confirmed by the PSP within 24 hours",
      baseline: "31%",
      target: "≥ 99.5%",
    },
    {
      id: "OBJ-3",
      statement: "Remove manual work from operations",
      kpi: "Manual cancellation tickets handled by operations per month",
      baseline: "1,100 / month",
      target: "< 100 / month",
    },
  ],
  inScope: [
    "Self-service cancellation of active UPI AutoPay mandates in the Acme mobile app",
    "Automatic revocation with the sponsor PSP, with retries",
    "Stopping future collections in the core ledger",
    "SMS and push notifications for each outcome",
    "Operations exception queue and a daily reconciliation report",
    "Audit trail for every request, response and operator action",
  ],
  outOfScope: [
    "Creating or modifying mandates",
    "Pausing a mandate instead of cancelling (phase 2)",
    "NACH e-mandates and card mandates",
    "Merchant-initiated cancellations",
  ],
  stakeholders: [
    {
      name: "Anil Kapoor",
      role: "Head of Payments (business sponsor)",
      raci: "A",
      interest: "Complaint volume and regulatory standing",
    },
    {
      name: "Priya Nair",
      role: "Product owner, Payments",
      raci: "R",
      interest: "Customer experience and delivery",
    },
    {
      name: "Rahul Mehta",
      role: "Business analyst",
      raci: "R",
      interest: "Requirement quality and traceability",
    },
    { name: "Meera Iyer", role: "Compliance lead", raci: "C", interest: "NPCI and RBI obligations, audit" },
    {
      name: "Suresh Rao",
      role: "Payments operations lead",
      raci: "C",
      interest: "Exception handling and reconciliation",
    },
    {
      name: "Vikram Shah",
      role: "Information security",
      raci: "C",
      interest: "Authentication and data protection",
    },
    {
      name: "Customer support",
      role: "Contact centre",
      raci: "I",
      interest: "Fewer calls, clear status to share",
    },
  ],
  currentState: [
    { actor: "Customer", step: "Calls support asking to cancel a mandate" },
    { actor: "Support agent", step: "Raises a ticket and copies details into the shared sheet" },
    { actor: "Operations", step: "Emails the PSP a batch of revocations once a day" },
    { actor: "PSP", step: "Revokes within 2–5 working days and replies by email" },
    { actor: "Operations", step: "Updates the ledger by hand; the customer is not told" },
  ],
  painPoints: [
    "Customers are debited after asking to cancel",
    "No status for the customer or support",
    "Around 1,100 manual tickets a month",
    "No reliable audit trail for regulators",
  ],
  futureState: [
    {
      actor: "Customer",
      step: "Sees active mandates in the app and cancels one after confirming with UPI PIN",
    },
    {
      actor: "System",
      step: "Records the request, returns a reference and revokes with the PSP automatically",
    },
    { actor: "System", step: "Stops future collections in the core ledger once the PSP confirms" },
    { actor: "System", step: "Notifies the customer by SMS and push" },
    { actor: "Operations", step: "Handles only the exceptions the system could not resolve" },
  ],
  requirements: [
    {
      id: "BR-01",
      title: "Cancel a mandate from the app",
      statement:
        "Customers shall be able to see their active UPI AutoPay mandates and cancel any of them from the Acme app.",
      rationale: "Removes the support call and the multi-day manual chain.",
      priority: "must",
      area: "Self-service cancellation",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Customer complaints analysis, Sep 2026",
      acceptance: [
        "The app lists every active mandate with merchant, maximum amount, frequency and next debit date",
        "A customer can cancel any active mandate in no more than 3 taps",
        "A confirmation with a reference number appears within 2 seconds",
      ],
    },
    {
      id: "BR-02",
      title: "Protect against accidental or duplicate cancellation",
      statement: "Every cancellation shall be confirmed by the customer and processed exactly once.",
      rationale: "Prevents fraud and double processing that create reconciliation breaks.",
      priority: "must",
      area: "Self-service cancellation",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Information security review",
      acceptance: [
        "The customer confirms with UPI PIN or device biometrics before a cancellation is accepted",
        "Submitting the same cancellation again returns the original reference and creates nothing new",
      ],
    },
    {
      id: "BR-03",
      title: "Track cancellation status",
      statement: "Customers shall see the status of each cancellation they requested.",
      rationale: "Stops repeat calls to support asking whether it worked.",
      priority: "should",
      area: "Self-service cancellation",
      actor: "Customer",
      objective: "OBJ-3",
      source: "Contact centre call drivers",
      acceptance: [
        "Status shows Requested, Revoked or Failed",
        "Status changes appear in the app within 1 minute",
      ],
    },
    {
      id: "BR-04",
      title: "Revoke automatically with the PSP",
      statement:
        "The system shall send each cancellation to the PSP for revocation without manual steps and keep trying when the PSP is unavailable.",
      rationale: "Meets the revocation window and removes daily email batches.",
      priority: "must",
      area: "Revocation with the PSP",
      actor: "System",
      objective: "OBJ-2",
      source: "NPCI AutoPay rules; PSP integration agreement",
      acceptance: [
        "The revocation is sent to the PSP within 1 minute of the request",
        "Failed calls are retried at least 5 times over 30 minutes",
        "After the last retry fails, a case is raised for operations",
      ],
    },
    {
      id: "BR-05",
      title: "Stop future debits",
      statement: "Once the PSP confirms a revocation, no further debit shall be collected for that mandate.",
      rationale: "The core reason customers complain.",
      priority: "must",
      area: "Revocation with the PSP",
      actor: "System",
      objective: "OBJ-1",
      source: "Complaints analysis; Compliance",
      acceptance: [
        "No debit is collected for a mandate after its revocation is confirmed",
        "If a debit is already in flight, the customer is told the date of that last debit",
      ],
    },
    {
      id: "BR-06",
      title: "Notify the customer",
      statement: "Customers shall be told the outcome of their cancellation by SMS and push notification.",
      rationale: "Gives certainty and evidence of cancellation.",
      priority: "must",
      area: "Customer communication",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Product owner",
      acceptance: [
        "SMS and push are sent within 5 minutes of a successful revocation",
        "The message names the merchant and includes the reference",
        "A failure message offers a callback from support",
      ],
    },
    {
      id: "BR-07",
      title: "Exception queue for operations",
      statement:
        "Operations shall have a queue of cancellations the system could not complete, with tools to retry or close them.",
      rationale: "Keeps humans only for the cases that need judgement.",
      priority: "should",
      area: "Operations",
      actor: "Operations analyst",
      objective: "OBJ-3",
      source: "Payments operations workshop, 12 Oct 2026",
      acceptance: [
        "Failed revocations appear in the queue within 5 minutes",
        "An analyst can retry or close a case with a reason",
        "Every action records who did it and when",
      ],
    },
    {
      id: "BR-08",
      title: "Daily reconciliation report",
      statement:
        "Operations shall receive a daily report comparing cancellations requested with PSP confirmations.",
      rationale: "Catches silent failures before customers do.",
      priority: "could",
      area: "Operations",
      actor: "Operations analyst",
      objective: "OBJ-2",
      source: "Payments operations workshop, 12 Oct 2026",
      acceptance: ["The report is available by 09:00 IST every day with mismatches listed first"],
    },
    {
      id: "BR-09",
      title: "Tamper-proof audit trail",
      statement:
        "Every cancellation request, PSP response and operator action shall be recorded and retained.",
      rationale: "Regulatory evidence and dispute resolution.",
      priority: "must",
      area: "Compliance and audit",
      actor: "Compliance officer",
      objective: "OBJ-2",
      source: "Compliance; RBI record-keeping guidance",
      acceptance: [
        "Records are kept for 10 years",
        "Records cannot be edited or deleted by any user",
        "Compliance can export the trail for one mandate within 1 minute",
      ],
    },
    {
      id: "BR-10",
      title: "Pause a mandate",
      statement: "Customers shall be able to pause a mandate for up to 90 days instead of cancelling it.",
      rationale: "Requested by customers, but needs PSP support not yet available.",
      priority: "wont",
      area: "Self-service cancellation",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Customer research",
      acceptance: ["A paused mandate collects nothing until it resumes"],
    },
  ],
  rules: [
    {
      id: "RULE-01",
      statement: "Only the account holder who created the mandate may cancel it.",
      source: "NPCI AutoPay rules",
    },
    {
      id: "RULE-02",
      statement:
        "If a debit is scheduled within the next 24 hours, cancellation takes effect after that debit and the customer is told before confirming.",
      source: "PSP integration agreement",
    },
    {
      id: "RULE-03",
      statement: "Cancellation cannot be undone; to resume, the customer creates a new mandate.",
      source: "Product policy",
    },
  ],
  nfrs: [
    {
      id: "NFR-01",
      category: "availability",
      statement: "Cancellation is available to customers",
      target: "99.95% per month",
    },
    {
      id: "NFR-02",
      category: "performance",
      statement: "The app confirms a cancellation request",
      target: "2 s at p95 under 1,200 requests/s",
    },
    {
      id: "NFR-03",
      category: "security",
      statement: "Step-up authentication for every cancellation",
      target: "100% of cancellations",
    },
    {
      id: "NFR-04",
      category: "compliance",
      statement: "Payment data is stored and processed only in India",
      target: "0 records outside India",
    },
    {
      id: "NFR-05",
      category: "reporting",
      statement: "Cancellation dashboard for the business",
      target: "Refreshed every 15 minutes",
    },
  ],
  data: [
    {
      entity: "Mandate",
      description: "Mandate id, merchant, limits, frequency, status",
      classification: "restricted",
      retention: "10 years",
    },
    {
      entity: "Cancellation event",
      description: "Request, PSP responses, ledger result, notifications",
      classification: "restricted",
      retention: "10 years",
    },
    {
      entity: "Customer contact",
      description: "Mobile number and device token for notifications",
      classification: "confidential",
      retention: "Life of account + 8 years",
    },
    {
      entity: "Idempotency key",
      description: "Prevents duplicate processing",
      classification: "internal",
      retention: "30 days",
    },
  ],
  assumptions: [
    "The PSP revocation API accepts idempotent requests",
    "About 5% of active mandates are cancelled each month (~450k)",
    "SMS templates can be registered on the DLT platform within 2 weeks",
  ],
  constraints: [
    "Must be live before the 15 Dec 2026 holiday peak",
    "The core ledger remains the system of record for collections",
    "No change to merchant-facing flows",
  ],
  dependencies: [
    "PSP sandbox and production credentials",
    "Core ledger team exposes a stop-collection API (LEDGER-482)",
    "DLT registration of new SMS templates",
  ],
  risks: [
    {
      id: "R-1",
      description: "PSP rate-limits revocations during month-end peaks",
      impact: "high",
      likelihood: "medium",
      mitigation: "Queue and throttle revocations; agree a peak quota with the PSP",
      owner: "Priya Nair",
    },
    {
      id: "R-2",
      description: "Ledger stop-collection API slips beyond November",
      impact: "high",
      likelihood: "medium",
      mitigation: "Interim batch file to the ledger every 30 minutes",
      owner: "Suresh Rao",
    },
    {
      id: "R-3",
      description: "Customers cancel the wrong mandate",
      impact: "medium",
      likelihood: "low",
      mitigation: "Confirmation screen shows merchant and next debit; support can raise a new mandate",
      owner: "Rahul Mehta",
    },
  ],
  successCriteria: [
    "Objective targets met within 90 days of launch",
    "Zero debits after a confirmed revocation in UAT and the first 30 days live",
    "Compliance signs off the audit export",
  ],
  glossary: [
    { term: "UPI AutoPay", definition: "NPCI's recurring-payment mandate on UPI" },
    { term: "Mandate", definition: "A customer's standing authorisation for a merchant to debit them" },
    { term: "PSP", definition: "Payment service provider bank that sponsors Acme on UPI" },
    { term: "Revocation", definition: "Cancelling a mandate at the PSP and NPCI" },
    { term: "DLT", definition: "TRAI's registry for commercial SMS templates in India" },
  ],
  openQuestions: [
    {
      id: "OQ-1",
      question: "What is the exact NPCI window for confirming a revocation?",
      owner: "Meera Iyer",
      status: "resolved",
      answer: "Compliance accepts a 24-hour business target; confirm against the latest NPCI circular at G1.",
    },
    {
      id: "OQ-2",
      question: "Do we refund automatically if a debit is collected after a confirmed revocation?",
      owner: "Anil Kapoor",
      status: "open",
    },
  ],
};

export const acmeHints: Record<string, StoryHint[]> = {
  "BR-01": [
    {
      title: "View active AutoPay mandates",
      asA: "customer",
      iWant: "to see all my active AutoPay mandates in one list",
      soThat: "I can find the one I want to cancel",
      criteria: [
        [
          "I have active mandates",
          "I open AutoPay in the app",
          "I see each mandate's merchant, maximum amount, frequency and next debit date",
        ],
        ["I have no active mandates", "I open AutoPay", "I see an empty state explaining what AutoPay is"],
      ],
      points: 5,
      components: ["mobile-app", "mandate-api"],
    },
    {
      title: "Cancel a mandate from the app",
      asA: "customer",
      iWant: "to cancel an active mandate in a few taps",
      soThat: "the merchant can't debit me again",
      criteria: [
        [
          "an active mandate",
          "I tap Cancel, review the details and confirm",
          "the request is accepted in no more than 3 taps",
        ],
        [
          "a debit is due within 24 hours",
          "I start a cancellation",
          "I'm told the cancellation takes effect after that debit (RULE-02)",
        ],
      ],
      points: 5,
      components: ["mobile-app", "mandate-api"],
    },
    {
      title: "Show a cancellation reference",
      asA: "customer",
      iWant: "a reference number as soon as I cancel",
      soThat: "I can quote it if something goes wrong",
      criteria: [
        ["I confirmed a cancellation", "the request is accepted", "a reference appears within 2 seconds"],
      ],
      points: 2,
      components: ["mobile-app"],
    },
  ],
  "BR-02": [
    {
      title: "Step-up authentication before cancelling",
      asA: "customer",
      iWant: "to confirm the cancellation with my UPI PIN or biometrics",
      soThat: "nobody else can cancel my mandates",
      criteria: [
        ["I'm on the confirmation screen", "I enter a correct UPI PIN", "the cancellation is submitted"],
        [
          "I enter a wrong PIN 3 times",
          "I try again",
          "cancellation is blocked for 24 hours and I'm told why",
        ],
      ],
      points: 5,
      components: ["mobile-app", "auth"],
      labels: ["security"],
    },
    {
      title: "Process each cancellation exactly once",
      asA: "customer",
      iWant: "repeated taps or retries not to create extra cancellations",
      soThat: "my mandate history stays correct",
      criteria: [
        [
          "a cancellation was accepted",
          "the same request arrives again",
          "the original reference is returned and nothing new is created",
        ],
      ],
      points: 3,
      components: ["mandate-api"],
    },
  ],
  "BR-03": [
    {
      title: "Show cancellation status",
      asA: "customer",
      iWant: "to see whether my cancellation is requested, revoked or failed",
      soThat: "I don't have to call support",
      criteria: [
        ["I requested a cancellation", "its status changes", "the app shows the new status within 1 minute"],
      ],
      points: 3,
      components: ["mobile-app", "mandate-api"],
    },
  ],
  "BR-04": [
    {
      title: "Send revocations to the PSP",
      asA: "payments system",
      iWant: "to send each cancellation to the PSP automatically",
      soThat: "mandates are revoked without manual steps",
      criteria: [
        ["a cancellation was accepted", "1 minute passes", "a revocation request has been sent to the PSP"],
      ],
      points: 5,
      components: ["revoke-worker", "psp-adapter"],
    },
    {
      title: "Retry failed revocations",
      asA: "payments system",
      iWant: "to retry revocations the PSP did not accept",
      soThat: "temporary PSP outages don't lose cancellations",
      criteria: [
        [
          "the PSP returns an error or times out",
          "the retry policy runs",
          "the call is retried at least 5 times over 30 minutes with backoff",
        ],
      ],
      points: 5,
      components: ["revoke-worker"],
    },
    {
      title: "Raise an operations case when retries run out",
      asA: "operations analyst",
      iWant: "a case for every revocation the system gave up on",
      soThat: "no cancellation is silently dropped",
      criteria: [
        [
          "all retries failed",
          "the last attempt fails",
          "a case appears in the exception queue with the PSP error",
        ],
      ],
      points: 3,
      components: ["revoke-worker", "ops-console"],
    },
  ],
  "BR-05": [
    {
      title: "Stop collections in the core ledger",
      asA: "customer",
      iWant: "no more debits once my mandate is revoked",
      soThat: "I'm not charged for something I cancelled",
      criteria: [
        [
          "the PSP confirmed the revocation",
          "the ledger's next collection run happens",
          "no debit is created for that mandate",
        ],
        [
          "the ledger API is unavailable",
          "the stop request fails",
          "it is retried and an alert is raised after 15 minutes",
        ],
      ],
      points: 8,
      components: ["ledger-adapter"],
      labels: ["dependency:LEDGER-482"],
    },
    {
      title: "Tell the customer about an in-flight debit",
      asA: "customer",
      iWant: "to know if one last debit will still happen",
      soThat: "I'm not surprised by it",
      criteria: [
        [
          "a debit is already in flight",
          "my cancellation is confirmed",
          "the confirmation shows the date and amount of that last debit",
        ],
      ],
      points: 3,
      components: ["mobile-app", "mandate-api"],
    },
  ],
  "BR-06": [
    {
      title: "Send revocation SMS and push",
      asA: "customer",
      iWant: "an SMS and push when my mandate is revoked",
      soThat: "I have proof it's cancelled",
      criteria: [
        [
          "the revocation succeeded",
          "5 minutes pass",
          "I've received an SMS and a push naming the merchant and the reference",
        ],
      ],
      points: 3,
      components: ["notifications"],
      labels: ["dependency:DLT-templates"],
    },
    {
      title: "Offer a callback when cancellation fails",
      asA: "customer",
      iWant: "to be offered a callback if my cancellation fails",
      soThat: "someone helps me finish it",
      criteria: [
        [
          "my revocation failed",
          "I'm notified",
          "the message offers a callback and the request appears in support's queue",
        ],
      ],
      points: 2,
      components: ["notifications"],
    },
  ],
  "BR-07": [
    {
      title: "Exception queue in the ops console",
      asA: "operations analyst",
      iWant: "a queue of cancellations the system couldn't complete",
      soThat: "I only handle the cases that need me",
      criteria: [
        [
          "a revocation failed after retries",
          "5 minutes pass",
          "the case is in my queue with mandate, merchant and last error",
        ],
      ],
      points: 5,
      components: ["ops-console"],
    },
    {
      title: "Retry or close a case with a reason",
      asA: "operations analyst",
      iWant: "to retry a case or close it with a reason",
      soThat: "every exception ends in a recorded decision",
      criteria: [
        [
          "a case in my queue",
          "I retry or close it with a reason",
          "the action, my name and the time are recorded",
        ],
      ],
      points: 3,
      components: ["ops-console"],
    },
  ],
  "BR-08": [
    {
      title: "Daily reconciliation report",
      asA: "operations analyst",
      iWant: "a daily report of cancellations versus PSP confirmations",
      soThat: "I catch silent failures early",
      criteria: [
        ["it is a business day", "09:00 IST arrives", "the report is available with mismatches listed first"],
      ],
      points: 5,
      components: ["reporting"],
    },
  ],
  "BR-09": [
    {
      title: "Immutable audit trail",
      asA: "compliance officer",
      iWant: "every request, PSP response and operator action recorded permanently",
      soThat: "we can evidence each cancellation to regulators",
      criteria: [
        ["any cancellation event", "it is stored", "it is write-once and retained for 10 years"],
        ["a mandate id", "I export its audit trail", "the export is ready within 1 minute"],
      ],
      points: 5,
      components: ["audit"],
      labels: ["compliance"],
    },
  ],
};
