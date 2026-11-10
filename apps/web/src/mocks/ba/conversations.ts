import type { BrdSource, BrdThread, ChatMessage, CommentThread, Proposal } from "@throughline/contracts";
import { readSource } from "./agent/sources";

/** Sample references and conversation history, so each seeded BRD shows how it was built. */

const done = (
  id: string,
  summary: string,
  target: string,
  status: Proposal["status"] = "accepted",
  cites: string[] = [],
): Proposal => ({
  id,
  summary,
  op: "add-row",
  target,
  rowId: null,
  value: {},
  cites,
  status,
});

const msg = (
  id: string,
  role: ChatMessage["role"],
  at: string,
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage => ({ id, role, at, text, cites: [], proposals: [], suggestions: [], ...extra });

const OPS_NOTES = `Payments operations workshop, 12 Oct 2026. Attendees: Suresh Rao, Rahul Mehta, two ops analysts.

Today every cancellation is a ticket. Analysts copy mandate details into the shared sheet and email the PSP once a day. The PSP replies in 2 to 5 working days.

Operations needs to see every revocation that failed after retries in one queue, within 5 minutes of the failure. Analysts must be able to retry a revocation or close it with a reason. Every action has to be recorded with who did it and when.

We also want a daily report by 09:00 IST comparing cancellations requested with PSP confirmations, mismatches first.

Risk: the PSP rate-limits revocations at month-end, which could delay thousands of cancellations.

Merchant-initiated cancellations are out of scope for this release.`;

const COMPLAINTS = `Customer complaints analysis, September 2026 (Contact centre and Payments).

Complaints about debits after a cancellation request: 2,400 per month, up from 600 a year ago. 31% of revocations are confirmed by the PSP within 24 hours.

Customers must be able to cancel a mandate themselves in the app and get a reference immediately. Customers should see the status of their cancellation without calling support.

Unified Payments Interface (UPI) AutoPay mandates now number 9 million active. The National Payments Corporation of India (NPCI) requires that customers can revoke a mandate at any time.`;

export function acmeSources(): BrdSource[] {
  return [
    {
      ...readSource(
        "S1",
        { kind: "note", title: "Ops workshop notes · 12 Oct", text: OPS_NOTES },
        "Rahul Mehta",
        [],
      ),
      addedAt: "2026-10-17T08:00:00Z",
    },
    {
      ...readSource(
        "S2",
        {
          kind: "file",
          fileName: "complaints-analysis-sep-2026.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 48_213,
          text: COMPLAINTS,
        },
        "Priya Nair",
        [],
      ),
      addedAt: "2026-10-17T08:05:00Z",
    },
    {
      ...readSource(
        "S3",
        {
          kind: "link",
          url: "https://www.npci.org.in/what-we-do/autopay/product-overview",
          title: "NPCI · UPI AutoPay overview",
        },
        "Meera Iyer",
        [],
      ),
      addedAt: "2026-10-18T10:00:00Z",
    },
  ];
}

export function acmeThread(): BrdThread {
  return {
    brdId: "BRD-31",
    agent: "simulated",
    autoApply: true,
    step: null,
    skipped: [],
    focus: null,
    messages: [
      msg(
        "M1",
        "agent",
        "2026-10-17T08:10:00Z",
        "I'm the BA agent. Tell me about the change in your own words, or attach reference material and tell me which to use.",
      ),
      msg(
        "M2",
        "user",
        "2026-10-17T08:12:00Z",
        "Customers can't cancel UPI AutoPay mandates themselves. They call support, ops emails the PSP and it takes days, so they keep getting debited. We want to cut complaints from 2,400 to under 500 a month. Customers must be able to cancel in the app.",
      ),
      msg(
        "M3",
        "agent",
        "2026-10-17T08:12:05Z",
        "I drafted 4 changes from that. Accept what's right; edit anything directly in the document.",
        {
          proposals: [
            done("P1", "Draft the executive summary", "summary"),
            done("P2", "Draft the problem statement", "problem"),
            done("P3", "Add OBJ-1: cut complaints from 2,400 to under 500 a month", "objectives"),
            done("P4", "Add BR-01 · Cancel a mandate from the app (must)", "requirements"),
          ],
        },
      ),
      msg("M4", "user", "2026-10-17T08:20:00Z", "use S1 and S2 for requirements"),
      msg(
        "M5",
        "agent",
        "2026-10-17T08:20:04Z",
        "From S1 “Ops workshop notes · 12 Oct” and S2 “complaints-analysis-sep-2026.docx” I found 5 requirements, 1 out-of-scope item, 1 risk, 2 glossary terms. Each one cites the passage it came from; accept the ones that are right.",
        {
          cites: ["S1.3", "S1.4", "S1.5", "S2.3"],
          proposals: [
            done("P5", "Add BR-07 · Exception queue for operations (should)", "requirements", "accepted", [
              "S1.3",
            ]),
            done("P6", "Add BR-08 · Daily reconciliation report (could)", "requirements", "accepted", [
              "S1.4",
            ]),
            done("P7", "Add BR-03 · Track cancellation status (should)", "requirements", "accepted", [
              "S2.3",
            ]),
            done("P8", "Add risk R-1: PSP rate-limits revocations at month-end", "risks", "accepted", [
              "S1.5",
            ]),
            done("P9", "Out of scope: merchant-initiated cancellations", "outOfScope", "accepted", ["S1.6"]),
            done("P10", "Glossary: UPI = Unified Payments Interface", "glossary", "rejected", ["S2"]),
          ],
        },
      ),
      msg("M6", "user", "2026-10-21T15:00:00Z", "make BR-04 testable"),
      msg(
        "M7",
        "agent",
        "2026-10-21T15:00:03Z",
        "Here's BR-04 with every vague phrase replaced by a measurable target. The numbers are placeholders: change them to your real targets before approval.",
        {
          proposals: [
            { ...done("P11", "Make BR-04 testable", "requirements"), op: "update-row", rowId: "BR-04" },
          ],
        },
      ),
      msg(
        "M8",
        "agent",
        "2026-10-23T11:20:00Z",
        "Rahul submitted v0.3 for approval. The document is locked while it's in review; raise a change request after approval to edit it again.",
      ),
    ],
  };
}

export function northwindSources(): BrdSource[] {
  return [
    {
      ...readSource(
        "S1",
        {
          kind: "note",
          title: "ISO 20022 programme brief",
          text: "SWIFT's MT/MX coexistence for cross-border payments ended in November 2025. The hub must create native pacs.008 messages with structured party data. Payments with missing structured address data should be stopped before submission. Inbound pacs.008 processing is out of scope for phase 1.",
        },
        "Omar Haddad",
        [],
      ),
      addedAt: "2026-10-09T09:00:00Z",
    },
  ];
}

export function northwindThread(): BrdThread {
  return {
    brdId: "BRD-199",
    agent: "simulated",
    autoApply: true,
    step: null,
    skipped: [],
    focus: null,
    messages: [
      msg(
        "M1",
        "agent",
        "2026-10-09T09:00:00Z",
        "I'm the BA agent. Tell me about the change, or attach reference material and tell me which to use.",
      ),
      msg("M2", "user", "2026-10-09T09:02:00Z", "use S1"),
      msg(
        "M3",
        "agent",
        "2026-10-09T09:02:04Z",
        "From S1 “ISO 20022 programme brief” I found 2 requirements and 1 out-of-scope item.",
        {
          cites: ["S1.1"],
          proposals: [
            done("P1", "Add BR-01 · Create native pacs.008 messages (must)", "requirements", "accepted", [
              "S1.1",
            ]),
            done(
              "P2",
              "Add BR-02 · Stop payments missing structured address data (should)",
              "requirements",
              "accepted",
              ["S1.1"],
            ),
            done("P3", "Out of scope: inbound pacs.008 processing", "outOfScope", "accepted", ["S1.1"]),
          ],
        },
      ),
      msg(
        "M4",
        "agent",
        "2026-10-16T08:00:00Z",
        "Approved as v1.0 by sponsor, compliance and architecture. The backlog was generated and pushed to Azure Boards.",
      ),
    ],
  };
}

export function fabrikamThread(): BrdThread {
  return {
    brdId: "BRD-12",
    agent: "simulated",
    autoApply: true,
    step: null,
    skipped: [],
    focus: "outOfScope",
    messages: [
      msg(
        "M1",
        "agent",
        "2026-10-20T10:00:00Z",
        "I drafted this from Finance's request. A few things are missing before it can go for approval.\n\nWhat's explicitly out of scope, so nobody assumes it's coming?",
        {
          suggestions: ["Nothing is out of scope"],
        },
      ),
    ],
  };
}

/** Review comments on BRD-31 while it's with the approvers. */
export function acmeComments(): CommentThread[] {
  return [
    {
      id: "C1",
      anchor: { section: "questions", rowId: "OQ-2", quote: null },
      resolved: false,
      resolvedBy: null,
      messages: [
        {
          id: "CM1",
          author: "Anil Kapoor",
          role: "human",
          at: "2026-10-23T14:02:00Z",
          text: "Approving, but OQ-2 needs a decision before G1. Finance's view is that we refund automatically under ₹2,000 and send the rest to ops.",
          proposals: [],
        },
        {
          id: "CM2",
          author: "Rahul Mehta",
          role: "human",
          at: "2026-10-23T16:40:00Z",
          text: "Agreed. I'll take it to the ops council on Monday and write the rule up as RULE-04 in v0.4.",
          proposals: [],
        },
      ],
    },
    {
      id: "C2",
      anchor: { section: "data", rowId: null, quote: null },
      resolved: true,
      resolvedBy: "Meera Iyer",
      messages: [
        {
          id: "CM3",
          author: "Meera Iyer",
          role: "human",
          at: "2026-10-22T10:15:00Z",
          text: "Audit records need 10-year write-once retention, not 5. Can we fix the data table before it goes for approval?",
          proposals: [],
        },
        {
          id: "CM4",
          author: "Rahul Mehta",
          role: "human",
          at: "2026-10-22T11:02:00Z",
          text: "Fixed in v0.3: cancellation events and PSP responses are now 10 years, write-once.",
          proposals: [],
        },
      ],
    },
  ];
}
