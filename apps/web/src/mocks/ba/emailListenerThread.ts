import type { BrdSource, BrdThread, ChatMessage, CommentThread, Proposal } from "@throughline/contracts";
import { readSource } from "./agent/sources";

/**
 * How BRD-40 was built: the sources the team attached, the whole guided conversation with the BA
 * agent (live edits, undo, structured entries, refinements, reviews) and the approvers' comments.
 */

const MAILBOX = `Support mailbox analysis and operations workshop, 2 Oct 2026. Kavita Rao, Priya Nair, Rahul Mehta, three shift leads.

The support@, disputes@ and grievance@ mailboxes receive about 14,000 emails a week, with peaks of 3,000 an hour after incidents. Median time to first response is 9.5 hours; overnight and weekend emails wait until the morning shift. 11% of emails are in Hindi or Hinglish.

Agents spend 11 minutes per email on average, about 4 of them finding the customer in the CRM and re-keying details into ServiceNow. 18% of emails are routed to the wrong queue and re-assigned at least once.

Operations needs every email to have a ServiceNow case with the right queue within minutes, and the routing table must be editable by operations without a release. Agents want a draft they can accept in a couple of clicks.`;

const PILOT = `AI CoE shadow pilot report, September 2026. 6,000 historical emails replayed through a prototype classifier and drafter. Nothing was sent to customers.

Intent accuracy was 91% across the 24-intent taxonomy, 96% on the 12 simplest intents. About 40% of emails are simple requests with a standard answer, such as statement copies, how-to questions and status of a known request. Agents rated 74% of drafts as usable with light edits.

A third of emails carried the key fact in an attachment: statements, screenshots and letters. The prototype ignored attachments, which caused most of its misclassifications.

Recommendation: start with drafting for all intents and automatic replies only for an allow-list, behind per-intent confidence thresholds, after four weeks of shadow mode in production.`;

const COMPLIANCE = `Compliance, CISO and AI governance requirements for the email listener. Meera Iyer, Arjun Shah, Neha Gupta, Deepak Verma, 9 Oct 2026.

Complaints must be identified at receipt. Under the RBI Integrated Ombudsman Scheme every complaint must be acknowledged within 24 hours with a reference and resolved or escalated within 30 days. 4.2% of email complaints breached these timelines last quarter. Complaints, fraud reports and legal correspondence must never be answered automatically.

Personal and financial data must be masked before any text is sent to a language model. Model endpoints must be in the India region with no data retained for training, in line with the DPDP Act 2023. Audit records must be kept for 8 years, write-once.

Email content is untrusted input. Prompt injection and phishing emails that impersonate customers are the main threats. Requests to change contact details or nominees by email must never be actioned.

Every automated decision must record the model version, prompt version, confidence and evidence. Operations must be able to pause automation immediately, and quality must be audited weekly on a random sample.`;

const done = (
  id: string,
  summary: string,
  target: string,
  status: Proposal["status"] = "accepted",
  cites: string[] = [],
  live = true,
): Proposal => ({
  id,
  summary,
  op: "add-row",
  target,
  rowId: null,
  value: {},
  cites,
  status,
  ...(live && (status === "accepted" || status === "reverted") ? { decidedBy: "BA agent" } : {}),
});

const msg = (
  id: string,
  role: ChatMessage["role"],
  at: string,
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage => ({ id, role, at, text, cites: [], proposals: [], suggestions: [], ...extra });

export function emailListenerSources(): BrdSource[] {
  return [
    {
      ...readSource(
        "S1",
        {
          kind: "file",
          fileName: "support-mailbox-analysis-oct-2026.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 61_402,
          text: MAILBOX,
        },
        "Priya Nair",
        [],
      ),
      addedAt: "2026-10-05T09:00:00Z",
    },
    {
      ...readSource(
        "S2",
        {
          kind: "file",
          fileName: "ai-coe-shadow-pilot-report.pdf",
          mimeType: "application/pdf",
          size: 412_880,
          text: PILOT,
        },
        "Neha Gupta",
        [],
      ),
      addedAt: "2026-10-05T09:02:00Z",
    },
    {
      ...readSource(
        "S3",
        { kind: "note", title: "Compliance, CISO and AI governance requirements", text: COMPLIANCE },
        "Meera Iyer",
        [],
      ),
      addedAt: "2026-10-09T12:00:00Z",
    },
  ];
}

export function emailListenerThread(): BrdThread {
  return {
    brdId: "BRD-40",
    agent: "simulated",
    autoApply: true,
    step: "review",
    skipped: [],
    focus: null,
    messages: [
      msg(
        "M1",
        "user",
        "2026-10-05T09:03:00Z",
        "I need a BRD for an agentic email listener on our support mailboxes. It should read every email, work out what the customer wants, create the ServiceNow case in the right queue, and draft replies for agents. Simple requests can be answered automatically. Median first response is 9.5 hours today; we want under 2 hours. Complaints and fraud must always go to a person.",
        { attachments: ["S1", "S2"], step: "context" },
      ),
      msg(
        "M2",
        "agent",
        "2026-10-05T09:03:06Z",
        "I've started the document from your message and the two attachments: 9 changes, written in on the right, each citing where it came from. Undo anything that isn't right.\n\nIn two or three sentences: who is the business sponsor, and why now?",
        {
          step: "context",
          cites: ["S1.2", "S1.3", "S2.2"],
          proposals: [
            done("P1", "Draft the executive summary", "summary"),
            done("P2", "Draft the problem statement", "problem", "accepted", ["S1.2", "S1.3"]),
            done("P3", "Add OBJ-1: first response from 9.5 hours to ≤ 2 hours", "objectives", "accepted", [
              "S1.2",
            ]),
            done("P4", "Add OBJ-2: handling time from 11 to ≤ 6 minutes", "objectives", "accepted", ["S1.3"]),
            done("P5", "Add OBJ-4: misrouting from 18% to < 3%", "objectives", "accepted", ["S1.3"]),
            done(
              "P6",
              "Add BR-01 · Listen to the support mailboxes in near real time (must)",
              "requirements",
            ),
            done(
              "P7",
              "Add BR-07 · Create and route the ServiceNow case (must)",
              "requirements",
              "accepted",
              ["S1.4"],
            ),
            done("P8", "Add BR-10 · Draft grounded replies for agents (must)", "requirements", "accepted", [
              "S2.2",
            ]),
            done(
              "P9",
              "Add BR-11 · Resolve allow-listed requests automatically (should)",
              "requirements",
              "accepted",
              ["S2.2"],
            ),
          ],
          suggestions: ["What's still missing?"],
        },
      ),
      msg(
        "M3",
        "user",
        "2026-10-05T09:10:00Z",
        "Sponsor is Sanjay Menon, Head of Customer Support. Volume is up 38% and the 2026 service strategy commits to 24×7 responsiveness without matching headcount.",
        { step: "context" },
      ),
      msg(
        "M4",
        "agent",
        "2026-10-05T09:10:03Z",
        "Added the background and Sanjay as Accountable. The Context step's exit checks pass, so let's move on to the problem and outcomes.",
        {
          step: "context",
          proposals: [
            done("P10", "Draft the background", "background"),
            done("P11", "Add stakeholder: Sanjay Menon, Head of Customer Support (A)", "stakeholders"),
          ],
          suggestions: ["Go to Problem & outcomes"],
        },
      ),
      msg(
        "M5",
        "agent",
        "2026-10-05T09:11:00Z",
        "Step 2 of 8 · Problem & outcomes. You have three objectives. S2 suggests about 40% of emails are simple requests: do you want an automation target, and is there a regulatory outcome?",
        { step: "problem" },
      ),
      msg(
        "M6",
        "user",
        "2026-10-05T09:14:00Z",
        "Objective · Resolve simple requests without an agent · KPI share auto-resolved · 0% → 35% with CSAT ≥ 4.2",
        {
          step: "problem",
          capture: { kind: "objective", statement: "Resolve simple requests without an agent" },
        },
      ),
      msg(
        "M7",
        "agent",
        "2026-10-05T09:14:03Z",
        "Added OBJ-3 as you wrote it. I tied the CSAT condition into the target so auto-resolution can't hit the number by closing cases badly. Is there a compliance outcome? Complaint timelines are usually the one regulators look at.",
        {
          step: "problem",
          proposals: [
            done(
              "P12",
              "Add OBJ-3: auto-resolve ≥ 35% with CSAT ≥ 4.2 / 5",
              "objectives",
              "accepted",
              [],
              false,
            ),
          ],
        },
      ),
      msg("M8", "user", "2026-10-09T12:05:00Z", "Yes. Use S3 for the compliance side.", {
        step: "problem",
        attachments: ["S3"],
      }),
      msg(
        "M9",
        "agent",
        "2026-10-09T12:05:05Z",
        "From S3 “Compliance, CISO and AI governance requirements” I found 1 objective, 3 requirements, 5 rules, 2 quality targets and 2 risks. They're in the document now, each citing its passage. One I'd challenge: S3 says 'resolved or escalated within 30 days', which I wrote as RULE-04, but the objective target should be 0% breaches, not 'fewer'.",
        {
          step: "problem",
          cites: ["S3.1", "S3.2", "S3.3", "S3.4"],
          proposals: [
            done(
              "P13",
              "Add OBJ-5: complaints breaching RBI timelines from 4.2% to 0%",
              "objectives",
              "accepted",
              ["S3.1"],
            ),
            done(
              "P14",
              "Add BR-05 · Redact personal data before the model sees it (must)",
              "requirements",
              "accepted",
              ["S3.2"],
            ),
            done(
              "P15",
              "Add BR-06 · Flag complaints, fraud and phishing at intake (must)",
              "requirements",
              "accepted",
              ["S3.1", "S3.3"],
            ),
            done("P16", "Add BR-13 · Switch the agent off per intent (must)", "requirements", "accepted", [
              "S3.4",
            ]),
            done(
              "P17",
              "Add RULE-01: complaints and fraud never answered automatically",
              "rules",
              "accepted",
              ["S3.1"],
            ),
            done("P18", "Add RULE-03: mask personal data; India region; no training", "rules", "accepted", [
              "S3.2",
            ]),
            done(
              "P19",
              "Add RULE-04: acknowledge complaints within 24 h, resolve within 30 days",
              "rules",
              "accepted",
              ["S3.1"],
            ),
            done(
              "P20",
              "Add RULE-05: log model and prompt versions with every decision",
              "rules",
              "accepted",
              ["S3.4"],
            ),
            done("P21", "Add RULE-07: never action contact-detail changes by email", "rules", "accepted", [
              "S3.3",
            ]),
            done("P22", "Add NFR-04 (security): PII redaction recall ≥ 99%", "nfrs", "accepted", ["S3.2"]),
            done(
              "P23",
              "Add NFR-06 (compliance): India region, 8-year write-once audit",
              "nfrs",
              "accepted",
              ["S3.2"],
            ),
            done("P24", "Add risk R-2: personal data leaks to the model provider", "risks", "accepted", [
              "S3.2",
            ]),
            done("P25", "Add risk R-3: prompt injection in an email", "risks", "accepted", ["S3.3"]),
          ],
        },
      ),
      msg(
        "M10",
        "agent",
        "2026-10-09T12:20:00Z",
        "Step 3 of 8 · Scope & people. In scope is drafted from S1 and S3. What's explicitly out? Other channels, actions on accounts and outbound email are the usual questions.",
        { step: "scope", suggestions: ["Nothing else is out of scope"] },
      ),
      msg(
        "M11",
        "user",
        "2026-10-09T12:24:00Z",
        "Out: WhatsApp, voice and app chat; any account actions like refunds or blocks; outbound marketing; languages other than English and Hindi.",
        { step: "scope" },
      ),
      msg(
        "M12",
        "agent",
        "2026-10-09T12:24:04Z",
        "Added 4 out-of-scope items. I also added the people S3 names as Consulted (Compliance, CISO office, AI CoE, principal nodal officer) and the agents as Informed. Kavita runs the queues; should she be Responsible alongside Priya?",
        {
          step: "scope",
          proposals: [
            done("P26", "Out of scope: voice, WhatsApp and app chat", "outOfScope"),
            done("P27", "Out of scope: taking actions on accounts from email", "outOfScope"),
            done("P28", "Out of scope: outbound marketing emails", "outOfScope"),
            done("P29", "Out of scope: languages other than English and Hindi", "outOfScope"),
            done(
              "P30",
              "Add stakeholders: Meera Iyer, Arjun Shah, Neha Gupta, Deepak Verma (C)",
              "stakeholders",
            ),
            done("P31", "Add stakeholder: contact centre agents (I)", "stakeholders"),
          ],
          suggestions: ["Yes, Kavita is Responsible"],
        },
      ),
      msg("M13", "user", "2026-10-09T12:25:00Z", "Yes, Kavita is Responsible", { step: "scope" }),
      msg("M14", "agent", "2026-10-09T12:25:02Z", "Done. Scope & people passes its checks.", {
        step: "scope",
        proposals: [
          done("P32", "Add stakeholder: Kavita Rao, Support operations manager (R)", "stakeholders"),
        ],
      }),
      msg(
        "M15",
        "agent",
        "2026-10-10T08:00:00Z",
        "Step 4 of 8 · Today & tomorrow. I drafted the as-is process from S1 (7 steps) and the to-be from your brief. Check the actors: is it the shift lead who assigns batches today?",
        {
          step: "process",
          cites: ["S1.2", "S1.3"],
          proposals: [
            done("P33", "Draft the current process (7 steps)", "currentState", "accepted", ["S1.2", "S1.3"]),
            done("P34", "Add 6 pain points", "painPoints", "accepted", ["S1.2", "S1.3"]),
            done("P35", "Draft the future process (7 steps)", "futureState"),
          ],
        },
      ),
      msg(
        "M16",
        "user",
        "2026-10-10T08:06:00Z",
        "Yes. And the to-be step 'Email listener replies to everything' is wrong: it only auto-replies for the allow-list.",
        { step: "process", context: { section: "future", rowId: null, quote: "replies to everything" } },
      ),
      msg(
        "M17",
        "agent",
        "2026-10-10T08:06:03Z",
        "You're right, that contradicted RULE-01 and RULE-02. I rewrote the step: “Resolves allow-listed low-risk intents itself, or drafts a cited reply for an agent.”",
        {
          step: "process",
          context: { section: "future", rowId: null, quote: "replies to everything" },
          proposals: [
            { ...done("P36", "Rewrite future step 4: allow-list only", "futureState"), op: "update-row" },
          ],
        },
      ),
      msg(
        "M18",
        "agent",
        "2026-10-12T09:00:00Z",
        "Step 5 of 8 · Requirements. You have 10 requirements. Gaps I can see against the process: attachments (a third of emails per S2), acknowledgements, complaint timers, customer matching, an agent console, a dashboard and Hindi. Want me to draft them?",
        { step: "requirements", cites: ["S2.3"], suggestions: ["Draft them", "Only the Musts"] },
      ),
      msg("M19", "user", "2026-10-12T09:02:00Z", "Draft them", { step: "requirements" }),
      msg(
        "M20",
        "agent",
        "2026-10-12T09:02:05Z",
        "Added 6 requirements with acceptance criteria. I set Hindi as Could (11% of volume, separate gold set needed) and other channels as Won't, so nobody expects them in this release.",
        {
          step: "requirements",
          proposals: [
            done("P37", "Add BR-02 · Read attachments (must)", "requirements", "accepted", ["S2.3"]),
            done(
              "P38",
              "Add BR-04 · Identify the customer and the things they mention (must)",
              "requirements",
              "accepted",
              ["S1.3"],
            ),
            done(
              "P39",
              "Add BR-08 · Acknowledge every email with a reference (must)",
              "requirements",
              "accepted",
              ["S3.1"],
            ),
            done(
              "P40",
              "Add BR-09 · Track complaint timelines and escalate (must)",
              "requirements",
              "accepted",
              ["S3.1"],
            ),
            done(
              "P41",
              "Add BR-12 · Agent console for review and feedback (must)",
              "requirements",
              "accepted",
              ["S1.4"],
            ),
            done(
              "P42",
              "Add BR-14 · Accuracy and operations dashboard (should)",
              "requirements",
              "accepted",
              ["S3.4"],
            ),
            done("P43", "Add BR-15 · Hindi emails (could)", "requirements", "accepted", ["S1.2"]),
            done("P44", "Add BR-16 · Other channels (won't)", "requirements"),
            done("P45", "Add BR-17 · Sentiment-based priority boost (should)", "requirements", "reverted"),
          ],
        },
      ),
      msg(
        "M21",
        "user",
        "2026-10-12T09:05:00Z",
        "I undid BR-17, sentiment is part of BR-03. Make BR-03 testable please.",
        { step: "requirements", context: { section: "requirements", rowId: "BR-03", quote: null } },
      ),
      msg(
        "M22",
        "agent",
        "2026-10-12T09:05:03Z",
        "BR-03 now has measurable criteria: ≥ 92% intent accuracy on the 2,000-email gold set, a confidence and version ids on every decision, and human triage below threshold. 92% is above the pilot's 91%; confirm it's achievable with Neha before approval.",
        {
          step: "requirements",
          context: { section: "requirements", rowId: "BR-03", quote: null },
          proposals: [
            { ...done("P46", "Make BR-03 testable", "requirements"), op: "update-row", rowId: "BR-03" },
          ],
        },
      ),
      msg(
        "M23",
        "user",
        "2026-10-12T09:20:00Z",
        "Requirement · Auto-resolve only allow-listed intents above threshold · must",
        { step: "requirements", capture: { kind: "requirement", title: "Allow-list threshold" } },
      ),
      msg(
        "M24",
        "agent",
        "2026-10-12T09:20:04Z",
        "That's already BR-11 plus RULE-02, so I didn't add a duplicate. I tightened BR-11's criteria to reference RULE-02 and RULE-06 (AI disclosure) instead.",
        {
          step: "requirements",
          proposals: [
            {
              ...done("P47", "Update BR-11 acceptance criteria", "requirements"),
              op: "update-row",
              rowId: "BR-11",
            },
          ],
        },
      ),
      msg(
        "M25",
        "agent",
        "2026-10-14T10:00:00Z",
        "Step 6 of 8 · Quality & data. Missing for a 24×7 service: availability with RPO/RTO, latency, peak throughput, prompt-injection resistance, safe degradation when the model is down, console usability and model monitoring. I've added them with numbers from S1 and S3; check the 99.9%.",
        {
          step: "quality",
          proposals: [
            done("P48", "Add NFR-01 (availability): 99.9%, RPO 0, RTO 15 min", "nfrs"),
            done("P49", "Add NFR-02 (performance): case p95 ≤ 60 s, draft p95 ≤ 90 s", "nfrs"),
            done("P50", "Add NFR-03 (performance): 20,000 / day, 3,000 / hour peak", "nfrs", "accepted", [
              "S1.2",
            ]),
            done("P51", "Add NFR-05 (security): blocks 100% of the red-team suite", "nfrs", "accepted", [
              "S3.3",
            ]),
            done("P52", "Add NFR-07 (availability): rules-based fallback within 5 minutes", "nfrs"),
            done("P53", "Add NFR-08 (usability): accept and send in ≤ 2 clicks", "nfrs"),
            done("P54", "Add NFR-09 (reporting): daily accuracy, drift alert", "nfrs", "accepted", ["S3.4"]),
            done("P55", "Add 6 data items with classification and retention", "data", "accepted", ["S3.2"]),
          ],
        },
      ),
      msg(
        "M26",
        "agent",
        "2026-10-15T09:00:00Z",
        "Step 7 of 8 · Risks & constraints. I added hallucinated answers (R-1), missed complaints (R-4), agent adoption (R-5) and cost spikes (R-6), with owners from the RACI. Constraints and dependencies come from S1 and your notes; the December change freeze is in.",
        {
          step: "risks",
          proposals: [
            done("P56", "Add risk R-1: wrong answers sent automatically", "risks", "accepted", ["S2.2"]),
            done("P57", "Add risk R-4: complaints missed by the classifier", "risks", "accepted", ["S3.1"]),
            done("P58", "Add risk R-5: agents don't trust the drafts", "risks"),
            done("P59", "Add risk R-6: incident-day cost spikes", "risks"),
            done("P60", "Add 4 assumptions, 4 constraints and 5 dependencies", "dependencies"),
          ],
        },
      ),
      msg(
        "M27",
        "agent",
        "2026-10-16T11:00:00Z",
        "Step 8 of 8 · Review. No blocking issues. Two warnings stay open on purpose: OQ-2 (account data in auto-replies) and OQ-3 (retention for non-complaint emails) are with Meera. Approvers will see them; the backlog will turn them into spikes.",
        { step: "review", suggestions: ["Go to sign-off"] },
      ),
      msg(
        "M28",
        "agent",
        "2026-10-16T15:30:00Z",
        "Priya submitted v0.9 for approval. The document is locked while sponsor, compliance, security and the AI CoE review it.",
        { step: "review" },
      ),
      msg(
        "M29",
        "agent",
        "2026-10-20T10:15:00Z",
        "Approved as v1.0 by Sanjay Menon, Meera Iyer, Arjun Shah and Neha Gupta. I generated the delivery backlog: epics per capability, features per requirement, stories with test scenarios and a definition of done, NFR enablers, go-live transition work and spikes for OQ-2 and OQ-3. Review it in Backlog before pushing to Jira.",
        { step: "review" },
      ),
    ],
  };
}

export function emailListenerComments(): CommentThread[] {
  return [
    {
      id: "C1",
      anchor: { section: "requirements", rowId: "BR-11", quote: null },
      resolved: true,
      resolvedBy: "Meera Iyer",
      messages: [
        {
          id: "CM1",
          author: "Meera Iyer",
          role: "human",
          at: "2026-10-17T10:00:00Z",
          text: "For auto-replies, can we guarantee a complaint is never closed automatically, even when a customer asks a simple question and complains in the same email?",
          proposals: [],
        },
        {
          id: "CM2",
          author: "BA agent",
          role: "agent",
          at: "2026-10-17T10:00:04Z",
          text: "Yes: RULE-01 is evaluated before RULE-02, so any complaint signal blocks automation regardless of the other intent's confidence. BR-11's third criterion tests exactly that case, and BR-06 targets 98% complaint recall.",
          proposals: [],
        },
        {
          id: "CM3",
          author: "Meera Iyer",
          role: "human",
          at: "2026-10-17T10:20:00Z",
          text: "Good, resolving.",
          proposals: [],
        },
      ],
    },
    {
      id: "C2",
      anchor: { section: "nfrs", rowId: "NFR-05", quote: null },
      resolved: true,
      resolvedBy: "Arjun Shah",
      messages: [
        {
          id: "CM4",
          author: "Arjun Shah",
          role: "human",
          at: "2026-10-18T07:30:00Z",
          text: "Who maintains the red-team suite, and does it run on every release?",
          proposals: [],
        },
        {
          id: "CM5",
          author: "Neha Gupta",
          role: "human",
          at: "2026-10-18T08:05:00Z",
          text: "AI CoE owns it; it runs in CI on every prompt or model change and nightly. We'll add 20 cases a quarter from real attempts.",
          proposals: [],
        },
      ],
    },
    {
      id: "C3",
      anchor: { section: "questions", rowId: "OQ-2", quote: null },
      resolved: false,
      resolvedBy: null,
      messages: [
        {
          id: "CM6",
          author: "Sanjay Menon",
          role: "human",
          at: "2026-10-19T12:00:00Z",
          text: "Approving. I'd like OQ-2 decided in sprint 1; refund-status emails are our biggest simple intent.",
          proposals: [],
        },
      ],
    },
  ];
}
