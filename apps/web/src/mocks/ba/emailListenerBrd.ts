import type { BrdContent } from "@throughline/contracts";
import type { StoryHint } from "./types";

/**
 * BRD-40: an agentic listener for the support mailbox. A complete, approved example that exercises
 * every part of the BRD and the backlog: objectives with KPIs, RACI, as-is / to-be, MoSCoW
 * requirements with acceptance criteria, rules, NFRs, classified data, risks, open questions.
 */
export const emailListenerBrdContent: BrdContent = {
  summary:
    "Acme's support mailboxes receive about 14,000 customer emails a week, and every one is read, classified and routed by hand. Customers wait a median 9.5 hours for a first response, 18% of emails land in the wrong queue, and 4.2% of regulatory complaints miss RBI timelines. This BRD defines an agentic email listener that reads every inbound support email within a minute, understands intent, urgency and the customer it concerns, redacts personal data, routes it to the right ServiceNow queue, drafts a grounded reply for an agent to approve, and resolves a small allow-list of low-risk requests on its own. Humans stay in control: complaints, fraud and anything uncertain always go to a person, every action is audited, and the agent can be switched off per intent.",
  problem:
    "Support email is handled entirely manually: 42 agents read 14,000 emails a week (peaks of 3,000 an hour after incidents), re-key details into ServiceNow and look up the customer in the CRM before they can reply. Median first response is 9.5 hours, average handling time is 11 minutes per email, 18% of emails are misrouted and bounce between teams, and 4.2% of complaints breach the RBI Integrated Ombudsman acknowledgement and resolution timelines, which creates regulatory exposure and repeat contacts.",
  background:
    "Email is Acme's second-largest support channel after the app chat and the only one with no automation. The 2026 service strategy commits to 24×7 responsiveness without growing headcount in line with volume (+38% year on year). The AI CoE has an approved Azure OpenAI deployment in Central India with a model governance framework, and ServiceNow Customer Service Management replaced Freshdesk in April 2026, which gives a single case API. A four-week shadow pilot on 6,000 historical emails classified intent correctly 91% of the time.",
  objectives: [
    {
      id: "OBJ-1",
      statement: "Respond to customers quickly, around the clock",
      kpi: "Median time to first meaningful response",
      baseline: "9.5 hours",
      target: "≤ 2 hours, with 100% acknowledged within 15 minutes",
      sources: ["S1.2"],
    },
    {
      id: "OBJ-2",
      statement: "Cut the effort agents spend per email",
      kpi: "Average handling time per email",
      baseline: "11 minutes",
      target: "≤ 6 minutes",
      sources: ["S1.3"],
    },
    {
      id: "OBJ-3",
      statement: "Resolve simple requests without an agent",
      kpi: "Share of inbound emails resolved automatically (allow-listed intents)",
      baseline: "0%",
      target: "≥ 35% with CSAT ≥ 4.2 / 5 on auto-resolved emails",
      sources: ["S2.2"],
    },
    {
      id: "OBJ-4",
      statement: "Send every email to the right team first time",
      kpi: "Misrouted emails (re-assigned to another queue)",
      baseline: "18%",
      target: "< 3%",
      sources: ["S1.3"],
    },
    {
      id: "OBJ-5",
      statement: "Meet regulatory complaint timelines every time",
      kpi: "Complaints breaching RBI acknowledgement or resolution timelines",
      baseline: "4.2%",
      target: "0%",
      sources: ["S3.1"],
    },
  ],
  inScope: [
    "Inbound email to support@, disputes@ and grievance@ shared mailboxes (Microsoft 365)",
    "Reading message bodies, threads and attachments (PDF, images via OCR, Office documents)",
    "Intent, urgency, sentiment and language classification against the 24-intent support taxonomy",
    "Entity extraction (customer, account, transaction, mandate, card last four) and CRM matching",
    "Personal data redaction before any text reaches the language model",
    "Ticket creation, update and routing in ServiceNow CSM",
    "Drafted replies grounded in the knowledge base, approved by an agent",
    "Automatic replies for an allow-list of low-risk intents, above a confidence threshold",
    "Complaint and fraud detection with escalation and SLA timers",
    "Agent console for review, feedback and overrides; accuracy and operations dashboards",
  ],
  outOfScope: [
    "Voice, WhatsApp and app-chat channels (separate initiative)",
    "Outbound marketing or proactive emails",
    "Taking actions on accounts (refunds, blocks, limit changes) from email",
    "Replacing ServiceNow workflows beyond case creation, routing and replies",
    "Languages other than English and Hindi",
  ],
  stakeholders: [
    {
      name: "Sanjay Menon",
      role: "Head of Customer Support (business sponsor)",
      raci: "A",
      interest: "Response times, cost per contact, regulatory standing",
    },
    {
      name: "Priya Nair",
      role: "Product owner, Digital servicing",
      raci: "R",
      interest: "Customer experience and delivery of the roadmap",
    },
    {
      name: "Kavita Rao",
      role: "Support operations manager",
      raci: "R",
      interest: "Queue health, agent workload, adoption",
    },
    {
      name: "Meera Iyer",
      role: "Compliance",
      raci: "C",
      interest: "RBI grievance redressal, DPDP Act, audit trail",
    },
    {
      name: "Arjun Shah",
      role: "CISO office",
      raci: "C",
      interest: "Data leakage, prompt injection, phishing",
    },
    {
      name: "Neha Gupta",
      role: "AI CoE lead",
      raci: "C",
      interest: "Model governance, evaluation and monitoring",
    },
    {
      name: "Deepak Verma",
      role: "Principal nodal officer (grievances)",
      raci: "C",
      interest: "Complaint classification and escalation",
    },
    {
      name: "Contact centre agents",
      role: "42 email agents across 3 shifts",
      raci: "I",
      interest: "Less re-keying, better drafts, fair workload",
    },
  ],
  currentState: [
    { actor: "Customer", step: "Emails support@ (or replies to an old thread) with a question or complaint" },
    { actor: "Shift lead", step: "Skims the shared mailbox every 30 minutes and assigns batches to agents" },
    { actor: "Agent", step: "Reads the email and attachments, works out what the customer wants" },
    { actor: "Agent", step: "Searches the CRM by email address or account number to find the customer" },
    { actor: "Agent", step: "Creates a ServiceNow case by hand, choosing category and queue" },
    {
      actor: "Agent",
      step: "Writes a reply from memory or the KB; complaints are forwarded to the grievance team",
    },
    { actor: "Grievance team", step: "Logs complaints in a spreadsheet to track RBI timelines" },
  ],
  painPoints: [
    "Nobody looks at an email for hours overnight and at weekends; median first response is 9.5 hours",
    "18% of emails are routed to the wrong queue and bounce between teams",
    "Agents spend about 4 of their 11 minutes finding the customer and re-keying details",
    "Complaints are spotted late; 4.2% breach RBI timelines",
    "Phishing emails that impersonate customers reach agents, who must spot them unaided",
    "No data on why customers write, so the KB and products don't improve",
  ],
  futureState: [
    {
      actor: "Email listener",
      step: "Picks up every new email within 60 seconds and acknowledges it with a case reference",
    },
    {
      actor: "Email listener",
      step: "Redacts personal data, then classifies intent, urgency, sentiment and language",
    },
    {
      actor: "Email listener",
      step: "Matches the customer in the CRM and creates or updates the ServiceNow case",
    },
    {
      actor: "Email listener",
      step: "Resolves allow-listed low-risk intents itself, or drafts a cited reply for an agent",
    },
    {
      actor: "Agent",
      step: "Reviews the draft in the console, edits if needed and sends; feedback is captured",
    },
    {
      actor: "Grievance team",
      step: "Receives complaints flagged at intake with RBI timers already running",
    },
    { actor: "Support operations", step: "Watches accuracy, volumes and SLAs on a live dashboard" },
  ],
  requirements: [
    {
      id: "BR-01",
      title: "Listen to the support mailboxes in near real time",
      statement:
        "The system shall pick up every new email in the support@, disputes@ and grievance@ mailboxes within 60 seconds of arrival, including replies on existing threads, without losing or duplicating any message.",
      rationale:
        "Nothing can start until the email is seen; overnight gaps drive the 9.5-hour first response.",
      priority: "must",
      area: "Mailbox ingestion",
      actor: "Email listener",
      objective: "OBJ-1",
      source: "Support operations workshop, 2 Oct 2026",
      acceptance: [
        "95% of emails are picked up within 60 seconds and 100% within 5 minutes",
        "Replies on an existing thread attach to the same ServiceNow case",
        "A mailbox outage raises an alert within 5 minutes and no email is lost after recovery",
      ],
      sources: ["S1.1"],
    },
    {
      id: "BR-02",
      title: "Read attachments",
      statement:
        "The system shall extract text from PDF, image (OCR) and Office attachments up to 20 MB and use it in classification and drafting.",
      rationale:
        "A third of emails carry the key fact in an attachment (bank statements, screenshots, letters).",
      priority: "must",
      area: "Mailbox ingestion",
      actor: "Email listener",
      objective: "OBJ-2",
      source: "Shadow pilot findings, S2",
      acceptance: [
        "Text is extracted from PDF, PNG, JPG, DOCX and XLSX attachments up to 20 MB",
        "Password-protected or unreadable files are flagged on the case and never block processing",
        "Executable or macro-enabled attachments are quarantined and never opened",
      ],
      sources: ["S2.3"],
    },
    {
      id: "BR-03",
      title: "Classify intent, urgency, sentiment and language",
      statement:
        "The system shall classify each email against the 24-intent support taxonomy with a confidence score, and assign urgency (P1–P4), sentiment and language.",
      rationale: "Correct classification drives routing, auto-resolution and complaint handling.",
      priority: "must",
      area: "Understanding and triage",
      actor: "Email listener",
      objective: "OBJ-4",
      source: "Support operations workshop, 2 Oct 2026",
      acceptance: [
        "Intent accuracy ≥ 92% on the 2,000-email gold set, measured per intent",
        "Every classification carries a confidence between 0 and 1 and the model and prompt versions",
        "Emails with confidence below the intent's threshold are marked for human triage",
      ],
      sources: ["S1.3", "S2.2"],
    },
    {
      id: "BR-04",
      title: "Identify the customer and the things they mention",
      statement:
        "The system shall extract customer identifiers, account numbers, transaction references, mandate ids and card last four, and match the sender to a CRM customer record.",
      rationale: "Agents spend about 4 minutes per email finding the customer and re-keying details.",
      priority: "must",
      area: "Understanding and triage",
      actor: "Email listener",
      objective: "OBJ-2",
      source: "Time-and-motion study, S1",
      acceptance: [
        "The sender is matched to a CRM record for ≥ 85% of emails from registered addresses",
        "Extracted references are validated against their format and shown on the case",
        "When several customers match, none is chosen and the case is marked for verification",
      ],
      sources: ["S1.3"],
    },
    {
      id: "BR-05",
      title: "Redact personal data before the model sees it",
      statement:
        "The system shall detect and mask personal and financial data (account and card numbers, Aadhaar, PAN, phone, address, OTPs) before any text is sent to the language model, and restore it only in agent-facing views.",
      rationale: "The DPDP Act and Acme's AI policy forbid sending unmasked personal data to a model.",
      priority: "must",
      area: "Understanding and triage",
      actor: "Email listener",
      objective: "OBJ-5",
      source: "CISO office and Compliance, S3",
      acceptance: [
        "Redaction recall ≥ 99% and precision ≥ 95% on the labelled PII test set",
        "Model prompts and logs never contain unmasked values (verified by automated scan)",
        "Agents with the right role see the original values in the console",
      ],
      sources: ["S3.2"],
    },
    {
      id: "BR-06",
      title: "Flag complaints, fraud and phishing at intake",
      statement:
        "The system shall flag emails that are complaints under the RBI definition, report fraud, or look like phishing or impersonation, and route them to the grievance or fraud team with the reason.",
      rationale:
        "Late detection causes 4.2% of complaints to breach RBI timelines; phishing reaches agents unchecked.",
      priority: "must",
      area: "Understanding and triage",
      actor: "Email listener",
      objective: "OBJ-5",
      source: "Principal nodal officer, S3",
      acceptance: [
        "Complaint recall ≥ 98% on the gold set (missing a complaint is worse than a false alarm)",
        "Fraud and phishing suspects go to the fraud queue within 2 minutes and are never auto-answered",
        "Each flag shows the evidence (phrases, sender checks) that triggered it",
      ],
      sources: ["S3.1", "S3.3"],
    },
    {
      id: "BR-07",
      title: "Create and route the ServiceNow case",
      statement:
        "The system shall create or update a ServiceNow CSM case for every email with category, priority, customer, extracted references and the classification, and assign it to the queue defined by the routing table.",
      rationale: "Manual case creation and routing cause re-keying and 18% misrouting.",
      priority: "must",
      area: "Routing and case management",
      actor: "Email listener",
      objective: "OBJ-4",
      source: "Support operations workshop, 2 Oct 2026",
      acceptance: [
        "Every processed email has a case within 2 minutes of arrival",
        "Queue assignment follows the routing table owned by support operations (editable without a release)",
        "If ServiceNow is unavailable, cases are queued and created in order once it recovers",
      ],
      sources: ["S1.4"],
    },
    {
      id: "BR-08",
      title: "Acknowledge every email with a reference",
      statement:
        "The system shall send an acknowledgement with the case reference and expected response time within 15 minutes of arrival, in the customer's language; complaints get the RBI-compliant acknowledgement.",
      rationale: "Customers chase when they hear nothing; RBI requires complaint acknowledgement.",
      priority: "must",
      area: "Routing and case management",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Compliance, S3",
      acceptance: [
        "100% of emails acknowledged within 15 minutes, with the case reference (RULE-04)",
        "No acknowledgement is sent to suspected phishing or auto-generated (no-reply, bounce) senders",
        "Acknowledgements are threaded on the customer's original email",
      ],
      sources: ["S3.1"],
    },
    {
      id: "BR-09",
      title: "Track complaint timelines and escalate",
      statement:
        "The system shall start RBI timers on every complaint, warn the owner before each deadline and escalate to the principal nodal officer when a deadline is at risk.",
      rationale: "Spreadsheet tracking misses deadlines.",
      priority: "must",
      area: "Routing and case management",
      actor: "Grievance team",
      objective: "OBJ-5",
      source: "Principal nodal officer, S3",
      acceptance: [
        "Timers start at email receipt, not when an agent opens the case",
        "Owner is warned 48 hours before a deadline; the nodal officer is alerted 24 hours before",
        "A weekly report lists every complaint with its timeline status",
      ],
      sources: ["S3.1"],
    },
    {
      id: "BR-10",
      title: "Draft grounded replies for agents",
      statement:
        "The system shall draft a reply for each email that needs a human, grounded only in the approved knowledge base and case data, with the sources cited, for the agent to edit and send.",
      rationale: "Writing replies from scratch is most of the 11-minute handling time.",
      priority: "must",
      area: "Agent assistance and automation",
      actor: "Agent",
      objective: "OBJ-2",
      source: "Shadow pilot findings, S2",
      acceptance: [
        "A draft is ready when the agent opens the case for ≥ 90% of non-complaint emails",
        "Every factual statement in a draft cites a KB article or case field",
        "≥ 70% of drafts are sent with light or no edits (edit distance < 20%) after 8 weeks",
      ],
      sources: ["S2.2"],
    },
    {
      id: "BR-11",
      title: "Resolve allow-listed requests automatically",
      statement:
        "The system shall reply and close the case without an agent for intents on the allow-list (e.g. statement copy, how-to, status of a known request) when confidence is at or above the intent's threshold.",
      rationale: "About 40% of emails are simple requests with a standard answer.",
      priority: "should",
      area: "Agent assistance and automation",
      actor: "Customer",
      objective: "OBJ-3",
      source: "Shadow pilot findings, S2",
      acceptance: [
        "Only allow-listed intents are auto-resolved and only above their threshold (RULE-02)",
        "Customers can reply 'not resolved' and reach an agent with the full history",
        "Auto-resolved emails show the AI disclosure footer (RULE-06)",
      ],
      sources: ["S2.2"],
    },
    {
      id: "BR-12",
      title: "Agent console for review and feedback",
      statement:
        "The system shall give agents a console in ServiceNow showing the classification, evidence, extracted data and draft, where they can accept, edit, re-classify or reject, and record why.",
      rationale: "Human oversight and feedback are needed to trust and improve the agent.",
      priority: "must",
      area: "Oversight and control",
      actor: "Agent",
      objective: "OBJ-2",
      source: "Support operations workshop, 2 Oct 2026",
      acceptance: [
        "Accept and send takes no more than 2 clicks",
        "Re-classification and rejection require a reason from a fixed list",
        "Every agent decision is stored as a labelled example for evaluation",
      ],
      sources: ["S1.4"],
    },
    {
      id: "BR-13",
      title: "Switch the agent off per intent",
      statement:
        "The system shall let support operations change confidence thresholds, remove intents from the allow-list or pause automation entirely, taking effect within 1 minute, with every change audited.",
      rationale: "Operations must be able to stop automation immediately if quality drops.",
      priority: "must",
      area: "Oversight and control",
      actor: "Support operations manager",
      objective: "OBJ-3",
      source: "AI CoE governance framework, S3",
      acceptance: [
        "A pause takes effect within 1 minute; emails then flow to human triage",
        "Only the support operations manager role can change thresholds or the allow-list",
        "Every change records who, when, old and new values",
      ],
      sources: ["S3.4"],
    },
    {
      id: "BR-14",
      title: "Accuracy and operations dashboard",
      statement:
        "The system shall report daily on volumes, intent accuracy, auto-resolution rate, CSAT, handling time, misrouting and complaint timelines, by intent and mailbox.",
      rationale: "The business case and model governance both need evidence.",
      priority: "should",
      area: "Oversight and control",
      actor: "Support operations manager",
      objective: "OBJ-3",
      source: "AI CoE governance framework, S3",
      acceptance: [
        "Dashboard refreshed by 09:00 IST daily with the previous day's data",
        "Accuracy is computed from agent feedback and a weekly audited sample of 200 emails",
        "Each KPI in this BRD has a trend line against its baseline and target",
      ],
      sources: ["S3.4"],
    },
    {
      id: "BR-15",
      title: "Hindi emails",
      statement:
        "The system shall classify and draft replies for emails written in Hindi or mixed Hindi-English, replying in the customer's language.",
      rationale: "11% of emails are in Hindi or Hinglish and wait longest today.",
      priority: "could",
      area: "Agent assistance and automation",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Mailbox analysis, S1",
      acceptance: [
        "Intent accuracy for Hindi emails ≥ 88% on a 300-email gold set",
        "Replies are drafted in the language the customer used",
      ],
      sources: ["S1.2"],
    },
    {
      id: "BR-16",
      title: "Other channels",
      statement: "The system shall apply the same listener to WhatsApp and app-chat messages.",
      rationale: "Requested by the digital team; covered by a separate initiative.",
      priority: "wont",
      area: "Agent assistance and automation",
      actor: "Customer",
      objective: "OBJ-1",
      source: "Digital channels roadmap",
      acceptance: ["Out of this release"],
    },
  ],
  rules: [
    {
      id: "RULE-01",
      statement:
        "Complaints, fraud reports, suspected phishing, legal or regulatory correspondence are never answered automatically; a person always replies.",
      source: "Compliance and CISO office",
      sources: ["S3.1"],
    },
    {
      id: "RULE-02",
      statement:
        "An email is auto-resolved only if its intent is on the allow-list and the confidence is at or above that intent's threshold (default 0.90).",
      source: "AI CoE governance framework",
      sources: ["S3.4"],
    },
    {
      id: "RULE-03",
      statement:
        "Personal and financial data is masked before any text is sent to a language model, and model calls stay in the India region with no data retained for training.",
      source: "CISO office; DPDP Act 2023",
      sources: ["S3.2"],
    },
    {
      id: "RULE-04",
      statement:
        "Every complaint is acknowledged within 24 hours with a complaint reference, and resolved or escalated within 30 days (RBI Integrated Ombudsman Scheme).",
      source: "RBI master direction on grievance redressal",
      sources: ["S3.1"],
    },
    {
      id: "RULE-05",
      statement:
        "Every automated decision and reply is logged with the model version, prompt version, confidence, evidence and the human who approved it, if any.",
      source: "AI CoE governance framework",
      sources: ["S3.4"],
    },
    {
      id: "RULE-06",
      statement:
        "Replies written or sent without human edits carry a disclosure that they were prepared with AI and how to reach a person.",
      source: "Compliance",
    },
    {
      id: "RULE-07",
      statement:
        "Requests to change contact details, nominees or limits received by email are never actioned; the customer is told to use the app or a branch.",
      source: "Fraud risk policy",
      sources: ["S3.3"],
    },
  ],
  nfrs: [
    {
      id: "NFR-01",
      category: "availability",
      statement: "Email ingestion and triage are available 24×7",
      target: "99.9% monthly; no email lost (RPO 0), recovery within 15 minutes (RTO)",
    },
    {
      id: "NFR-02",
      category: "performance",
      statement: "Triage completes quickly after arrival",
      target: "p95 ≤ 60 s from arrival to case created; draft ready p95 ≤ 90 s",
    },
    {
      id: "NFR-03",
      category: "performance",
      statement: "The service handles peak volume",
      target: "20,000 emails / day sustained, 3,000 / hour peak, with no queue older than 5 minutes",
    },
    {
      id: "NFR-04",
      category: "security",
      statement: "Personal data is protected end to end",
      target:
        "PII redaction recall ≥ 99%; TLS 1.2+ in transit, AES-256 at rest; zero unmasked PII in prompts or logs",
    },
    {
      id: "NFR-05",
      category: "security",
      statement: "The agent resists prompt injection and malicious content",
      target:
        "Blocks 100% of the 150-case red-team injection suite; email content never changes tool permissions",
    },
    {
      id: "NFR-06",
      category: "compliance",
      statement: "Data and model calls stay in India and are fully auditable",
      target:
        "100% of processing in Azure Central India / South India; audit records kept 8 years, write-once",
    },
    {
      id: "NFR-07",
      category: "availability",
      statement: "The service degrades safely when the model is unavailable",
      target: "Rules-based routing takes over within 5 minutes; 0 emails left unrouted",
    },
    {
      id: "NFR-08",
      category: "usability",
      statement: "Agents can act on a draft quickly",
      target: "Accept-and-send in ≤ 2 clicks; console loads in ≤ 2 s p95; WCAG 2.2 AA",
    },
    {
      id: "NFR-09",
      category: "reporting",
      statement: "Model quality is monitored continuously",
      target: "Daily accuracy by intent; alert when any intent drops 5 points below its 4-week average",
    },
  ],
  data: [
    {
      entity: "Email message",
      description: "Headers, body, thread id and mailbox of each inbound email",
      classification: "confidential",
      retention: "8 years for complaints, 2 years otherwise",
    },
    {
      entity: "Attachment",
      description: "Original files and extracted text",
      classification: "restricted",
      retention: "Same as the email; quarantined files 30 days",
    },
    {
      entity: "Customer identifiers",
      description: "CRM id, account and card last four, mandate ids extracted from the email",
      classification: "restricted",
      retention: "Held on the case, per CRM retention",
    },
    {
      entity: "Triage decision",
      description: "Intent, urgency, confidence, evidence, model and prompt versions",
      classification: "internal",
      retention: "8 years, write-once (audit)",
    },
    {
      entity: "Reply",
      description: "Drafted, edited and sent replies with citations",
      classification: "confidential",
      retention: "8 years for complaints, 2 years otherwise",
    },
    {
      entity: "Agent feedback",
      description: "Accept / edit / re-classify decisions and reasons",
      classification: "internal",
      retention: "3 years (model evaluation)",
    },
  ],
  assumptions: [
    "Microsoft Graph application access to the three shared mailboxes is approved by IT",
    "The AI CoE's Azure OpenAI deployment in Central India has capacity for 20,000 emails a day",
    "The knowledge base (Confluence) is current for the 12 allow-listed intents before launch",
    "Agents will give feedback on drafts as part of their normal flow",
  ],
  constraints: [
    "Must run in Acme's Azure tenancy; no third-party SaaS may process email content",
    "Go-live before the 31 March 2027 financial-year end, outside the December change freeze",
    "No change to ServiceNow core tables; integration uses the CSM REST API",
    "Budget: ₹1.6 crore build, ₹28 lakh a year run cost (models and hosting)",
  ],
  dependencies: [
    "IT: Graph API app registration and mailbox permissions (ServiceNow change CHG-2291)",
    "AI CoE: model endpoint, evaluation harness and governance sign-off",
    "ServiceNow platform team: CSM API access and the routing table extension",
    "Knowledge management: KB articles for the 12 allow-listed intents reviewed",
    "CRM team: customer lookup API with rate limits for 3,000 calls an hour",
  ],
  risks: [
    {
      id: "R-1",
      description: "Wrong or invented answers sent automatically damage trust and could mislead customers",
      impact: "high",
      likelihood: "medium",
      mitigation:
        "Allow-list only, per-intent thresholds, grounded drafts with citations, 4-week shadow mode, weekly audited sample, kill switch (BR-13)",
      owner: "Neha Gupta",
      sources: ["S2.2"],
    },
    {
      id: "R-2",
      description: "Personal data leaks to the model provider or into logs",
      impact: "high",
      likelihood: "low",
      mitigation:
        "Redaction before model calls (RULE-03), in-region endpoint with no retention, automated log scanning",
      owner: "Arjun Shah",
      sources: ["S3.2"],
    },
    {
      id: "R-3",
      description: "Prompt injection in an email makes the agent ignore instructions or reveal data",
      impact: "high",
      likelihood: "medium",
      mitigation:
        "Email treated as data only, no tools that act on accounts, output filters, red-team suite in CI (NFR-05)",
      owner: "Arjun Shah",
      sources: ["S3.3"],
    },
    {
      id: "R-4",
      description: "Complaints are missed by the classifier and breach RBI timelines",
      impact: "high",
      likelihood: "low",
      mitigation:
        "Tune for complaint recall ≥ 98%, keyword safety net, daily sample review by the grievance team",
      owner: "Deepak Verma",
      sources: ["S3.1"],
    },
    {
      id: "R-5",
      description: "Agents don't trust the drafts and rewrite them, so handling time doesn't fall",
      impact: "medium",
      likelihood: "medium",
      mitigation:
        "Agents co-design the console, champions per shift, publish edit-rate by intent and act on it",
      owner: "Kavita Rao",
    },
    {
      id: "R-6",
      description: "Incident-day volume spikes push model costs over budget",
      impact: "medium",
      likelihood: "medium",
      mitigation:
        "Per-day token budget with alerts, deduplicate incident emails, fall back to rules-based routing",
      owner: "Priya Nair",
    },
  ],
  successCriteria: [
    "All five objectives at target for two consecutive months after hypercare",
    "Zero RBI timeline breaches for complaints received by email in the first quarter",
    "No P1 security or privacy incident attributable to the listener",
    "Agent satisfaction with the console ≥ 4 / 5 in the 90-day survey",
  ],
  glossary: [
    { term: "Allow-list", definition: "Intents the agent may answer and close on its own" },
    {
      term: "Confidence threshold",
      definition: "Minimum model confidence for an automated action on an intent (default 0.90)",
    },
    {
      term: "Grounded reply",
      definition: "A reply whose facts come only from cited KB articles or case data",
    },
    { term: "HITL", definition: "Human in the loop: a person reviews before anything is sent" },
    {
      term: "Shadow mode",
      definition: "The agent classifies and drafts but sends nothing; results are compared with agents",
    },
    { term: "CSM", definition: "ServiceNow Customer Service Management" },
    { term: "DPDP Act", definition: "Digital Personal Data Protection Act, 2023 (India)" },
    { term: "Intent taxonomy", definition: "The 24 reasons customers write, owned by support operations" },
  ],
  openQuestions: [
    {
      id: "OQ-1",
      question: "Which ticketing system do we integrate with?",
      owner: "Kavita Rao",
      status: "resolved",
      answer: "ServiceNow CSM; Freshdesk was retired in April 2026.",
    },
    {
      id: "OQ-2",
      question:
        "Can auto-replies include account-specific data (e.g. refund status) in the MVP, or only knowledge-base answers?",
      owner: "Meera Iyer",
      status: "open",
    },
    {
      id: "OQ-3",
      question: "Do non-complaint emails need 2 or 5 years' retention?",
      owner: "Meera Iyer",
      status: "open",
    },
  ],
};

/** How the BA agent split each requirement into stories during refinement. */
export const emailListenerHints: Record<string, StoryHint[]> = {
  "BR-01": [
    {
      title: "Subscribe to new mail in the shared mailboxes",
      asA: "support operations manager",
      iWant: "every new email in support@, disputes@ and grievance@ picked up as soon as it arrives",
      soThat: "no customer waits for someone to open the mailbox",
      criteria: [
        [
          "a new email arrives in a monitored mailbox",
          "the Graph change notification is received",
          "the email is queued for triage within 60 seconds",
        ],
        [
          "notifications stop arriving for 5 minutes",
          "the health check runs",
          "the listener falls back to polling and raises an alert",
        ],
      ],
      points: 5,
      components: ["mail-connector", "event-queue"],
      labels: ["integration"],
      edge: ["Graph subscription expires (every 3 days): it is renewed before expiry with no gap."],
      notes: ["Use Graph change notifications with lifecycle events; delta query as the safety net."],
    },
    {
      title: "Keep threads together and never process an email twice",
      asA: "agent",
      iWant: "replies on a thread attached to the same case and duplicates ignored",
      soThat: "I see one conversation per customer issue",
      criteria: [
        [
          "an email replies to a thread that already has a case",
          "it is processed",
          "it is added to that case, not a new one",
        ],
        ["the same message id is delivered twice", "the listener receives it", "it is processed once"],
      ],
      points: 3,
      components: ["mail-connector", "triage-service"],
      nfrs: ["NFR-01", "NFR-02"],
      dependsOn: ["Subscribe to new mail in the shared mailboxes"],
    },
    {
      title: "Recover without losing email after an outage",
      asA: "support operations manager",
      iWant: "every email that arrived during an outage processed in order once the service recovers",
      soThat: "no customer email is ever lost",
      criteria: [
        [
          "the listener was down for 30 minutes",
          "it restarts",
          "every email from the gap is processed in arrival order",
        ],
        [
          "recovery is in progress",
          "I open the dashboard",
          "I see the backlog size and expected catch-up time",
        ],
      ],
      points: 5,
      components: ["mail-connector", "event-queue"],
      labels: ["resilience"],
      dependsOn: ["Subscribe to new mail in the shared mailboxes"],
    },
  ],
  "BR-02": [
    {
      title: "Extract text from attachments",
      asA: "agent",
      iWant: "the text of PDFs, images and Office files on the case",
      soThat: "I don't have to open each attachment to understand the request",
      criteria: [
        [
          "an email with a scanned PDF bank statement",
          "triage runs",
          "the extracted text is used for classification and shown on the case",
        ],
        [
          "a password-protected PDF",
          "triage runs",
          "the case is flagged 'attachment unreadable' and processing continues",
        ],
      ],
      points: 5,
      components: ["attachment-service", "ocr"],
      edge: ["A 20 MB multi-page TIFF is processed within the NFR-02 time budget."],
    },
    {
      title: "Quarantine dangerous attachments",
      asA: "security analyst",
      iWant: "executables and macro-enabled files quarantined and never opened",
      soThat: "malware can't reach agents or our systems",
      criteria: [
        [
          "an email with an .exe or .docm attachment",
          "it is scanned",
          "the file is quarantined, the case flagged and the CISO queue notified",
        ],
      ],
      points: 3,
      components: ["attachment-service", "malware-scan"],
      labels: ["security"],
    },
  ],
  "BR-03": [
    {
      title: "Classify intent with a confidence score",
      asA: "support operations manager",
      iWant: "each email classified into one of the 24 intents with a confidence score",
      soThat: "it can be routed and handled the right way",
      criteria: [
        [
          "the 2,000-email gold set",
          "the classifier runs in the evaluation pipeline",
          "accuracy is at least 92% and is reported per intent",
        ],
        [
          "an email the model is unsure about",
          "its confidence is below the intent's threshold",
          "it is marked for human triage",
        ],
      ],
      points: 8,
      components: ["triage-service", "llm-gateway"],
      labels: ["ai"],
      notes: ["Prompt and taxonomy are versioned; version ids are stored with each decision (RULE-05)."],
    },
    {
      title: "Set urgency, sentiment and language",
      asA: "shift lead",
      iWant: "each email tagged with urgency P1–P4, sentiment and language",
      soThat: "the most urgent and upset customers are answered first",
      criteria: [
        [
          "an email mentions money debited without consent",
          "triage runs",
          "urgency is P1 and the case is at the top of the queue",
        ],
        ["an email in Hinglish", "triage runs", "language is recorded as hi-en"],
      ],
      points: 3,
      components: ["triage-service", "llm-gateway"],
      labels: ["ai"],
      dependsOn: ["Classify intent with a confidence score"],
    },
  ],
  "BR-04": [
    {
      title: "Extract references from the email",
      asA: "agent",
      iWant:
        "account numbers, transaction references, mandate ids and card last four pulled out and validated",
      soThat: "I don't re-key them into the case",
      criteria: [
        [
          "an email quoting a UPI transaction reference",
          "extraction runs",
          "the reference is validated against its format and shown on the case",
        ],
        [
          "a reference fails validation",
          "extraction runs",
          "it is shown as 'unverified' and not used for matching",
        ],
      ],
      points: 5,
      components: ["triage-service", "llm-gateway"],
      nfrs: ["NFR-02", "NFR-04"],
      labels: ["ai"],
    },
    {
      title: "Match the sender to the customer record",
      asA: "agent",
      iWant: "the email matched to the right CRM customer",
      soThat: "I see who they are and their recent activity straight away",
      criteria: [
        ["an email from a registered address", "matching runs", "the case is linked to that customer"],
        [
          "two customers share the address",
          "matching runs",
          "no customer is chosen and the case is marked 'verify customer'",
        ],
      ],
      points: 5,
      components: ["crm-adapter", "triage-service"],
      nfrs: ["NFR-02", "NFR-04"],
      dependsOn: ["Extract references from the email"],
      edge: ["CRM lookup times out: the case is created unmatched and matching retries for 10 minutes."],
    },
  ],
  "BR-05": [
    {
      title: "Mask personal data before model calls",
      asA: "CISO office",
      iWant: "account and card numbers, Aadhaar, PAN, phone, address and OTPs masked before any model call",
      soThat: "no personal data leaves our control (RULE-03)",
      criteria: [
        [
          "the labelled PII test set",
          "the redactor runs",
          "recall is at least 99% and precision at least 95%",
        ],
        [
          "any model call",
          "the prompt is inspected by the automated scanner",
          "it contains no unmasked value",
        ],
      ],
      points: 8,
      components: ["pii-redactor", "llm-gateway"],
      labels: ["security", "compliance"],
      nfrs: ["NFR-04", "NFR-06"],
    },
    {
      title: "Show original values only to authorised agents",
      asA: "agent",
      iWant: "to see the real values behind masked fields when my role allows",
      soThat: "I can help the customer without asking them again",
      criteria: [
        [
          "an agent with the 'PII view' role",
          "they open the case",
          "masked values are shown in full and the view is logged",
        ],
        ["an agent without the role", "they open the case", "values stay masked"],
      ],
      points: 3,
      components: ["agent-console", "pii-redactor"],
      labels: ["security"],
      dependsOn: ["Mask personal data before model calls"],
    },
  ],
  "BR-06": [
    {
      title: "Detect complaints at intake",
      asA: "principal nodal officer",
      iWant: "every complaint flagged the moment it arrives, with the evidence",
      soThat: "RBI timelines start on time and none are missed",
      criteria: [
        ["the gold set's 400 complaints", "the classifier runs", "complaint recall is at least 98%"],
        [
          "an email flagged as a complaint",
          "triage completes",
          "it goes to the grievance queue and is never auto-answered (RULE-01)",
        ],
      ],
      points: 5,
      components: ["triage-service", "llm-gateway"],
      nfrs: ["NFR-02", "NFR-06", "NFR-09"],
      labels: ["compliance", "ai"],
      dependsOn: ["Classify intent with a confidence score"],
    },
    {
      title: "Detect phishing and impersonation",
      asA: "fraud analyst",
      iWant: "emails that look like phishing or impersonation flagged with the reasons",
      soThat: "agents don't act on fraudulent requests",
      criteria: [
        [
          "an email failing SPF/DKIM from a lookalike domain",
          "triage runs",
          "it is flagged as suspected phishing and sent to the fraud queue within 2 minutes",
        ],
        [
          "an email asking to change the registered mobile number",
          "triage runs",
          "it is not actioned and the customer is told to use the app (RULE-07)",
        ],
      ],
      points: 5,
      components: ["triage-service", "sender-checks"],
      labels: ["security"],
    },
  ],
  "BR-07": [
    {
      title: "Create or update the ServiceNow case",
      asA: "agent",
      iWant: "a ServiceNow case created with the category, priority, customer and extracted data",
      soThat: "I start with everything in one place",
      criteria: [
        ["a triaged email", "the adapter runs", "a CSM case exists within 2 minutes with all triage fields"],
        [
          "ServiceNow returns errors",
          "the adapter retries",
          "the case is created in order once it recovers and nothing is lost",
        ],
      ],
      points: 5,
      components: ["servicenow-adapter"],
      nfrs: ["NFR-01", "NFR-02", "NFR-07"],
      labels: ["integration"],
      dependsOn: ["Classify intent with a confidence score"],
    },
    {
      title: "Route cases with an editable routing table",
      asA: "support operations manager",
      iWant: "to change which queue each intent and mailbox goes to without a release",
      soThat: "routing keeps up with how the teams are organised",
      criteria: [
        [
          "I change the queue for the 'card dispute' intent",
          "the next card dispute arrives",
          "it goes to the new queue",
        ],
        ["a routing change", "it is saved", "who, when and the old and new values are logged"],
      ],
      points: 3,
      components: ["servicenow-adapter", "admin-console"],
      nfrs: ["NFR-02"],
      dependsOn: ["Create or update the ServiceNow case"],
    },
  ],
  "BR-08": [
    {
      title: "Send acknowledgements with the case reference",
      asA: "customer",
      iWant: "an acknowledgement with my reference and when to expect an answer",
      soThat: "I know my email arrived and don't need to chase",
      criteria: [
        [
          "any email from a customer",
          "its case is created",
          "an acknowledgement with the reference is sent within 15 minutes, in the thread",
        ],
        [
          "an email from a no-reply address or a suspected phishing sender",
          "triage completes",
          "no acknowledgement is sent",
        ],
        [
          "a complaint",
          "it is acknowledged",
          "the RBI-compliant complaint template with the complaint reference is used (RULE-04)",
        ],
      ],
      points: 3,
      components: ["reply-service", "servicenow-adapter"],
      nfrs: ["NFR-01", "NFR-02"],
      labels: ["compliance"],
      dependsOn: ["Create or update the ServiceNow case"],
    },
  ],
  "BR-09": [
    {
      title: "Start and track RBI timers on complaints",
      asA: "principal nodal officer",
      iWant: "timers that start when a complaint arrives and warnings before each deadline",
      soThat: "no complaint breaches a regulatory timeline",
      criteria: [
        [
          "a complaint received at 23:50",
          "its case is created",
          "the timers start from 23:50, not when an agent opens it",
        ],
        [
          "a complaint 48 hours from its deadline",
          "the timer job runs",
          "the owner is warned; at 24 hours the nodal officer is alerted",
        ],
      ],
      points: 5,
      components: ["servicenow-adapter", "sla-engine"],
      labels: ["compliance"],
      dependsOn: ["Detect complaints at intake"],
    },
    {
      title: "Weekly complaint timeline report",
      asA: "principal nodal officer",
      iWant: "a weekly list of every complaint and its timeline status",
      soThat: "I can report to the board and the regulator",
      criteria: [
        [
          "it is Monday 08:00 IST",
          "the report runs",
          "every open and closed complaint from the week is listed with its status",
        ],
      ],
      points: 2,
      components: ["analytics"],
      labels: ["compliance"],
    },
  ],
  "BR-10": [
    {
      title: "Retrieve the right knowledge-base articles",
      asA: "agent",
      iWant: "the most relevant approved KB articles found for each email",
      soThat: "drafts are based on our policy, not the model's memory",
      criteria: [
        [
          "the 500-question retrieval test set",
          "retrieval runs",
          "a correct article is in the top 3 for at least 90%",
        ],
        ["an article is withdrawn", "the index refreshes", "it is no longer used within 1 hour"],
      ],
      points: 5,
      components: ["kb-retrieval", "search-index"],
      nfrs: ["NFR-02", "NFR-05"],
      labels: ["ai"],
    },
    {
      title: "Draft a cited reply for the agent",
      asA: "agent",
      iWant: "a draft reply with each fact cited to a KB article or case field",
      soThat: "I can check and send it quickly",
      criteria: [
        ["a non-complaint email needing an agent", "I open the case", "a draft is ready with citations"],
        [
          "the KB has no answer",
          "drafting runs",
          "no answer is invented; the draft asks the agent to respond and says why",
        ],
      ],
      points: 8,
      components: ["reply-service", "llm-gateway"],
      nfrs: ["NFR-02", "NFR-05", "NFR-08"],
      labels: ["ai"],
      dependsOn: ["Retrieve the right knowledge-base articles", "Mask personal data before model calls"],
    },
  ],
  "BR-11": [
    {
      title: "Auto-resolve allow-listed intents",
      asA: "customer",
      iWant: "simple requests answered straight away",
      soThat: "I don't wait for an agent for something standard",
      criteria: [
        [
          "an email with an allow-listed intent and confidence 0.94 (threshold 0.90)",
          "triage completes",
          "the reply is sent with the AI disclosure and the case is resolved (RULE-02, RULE-06)",
        ],
        ["the same intent with confidence 0.86", "triage completes", "a draft goes to an agent instead"],
        ["a complaint, even with high confidence", "triage completes", "it is never auto-resolved (RULE-01)"],
      ],
      points: 8,
      components: ["reply-service", "policy-engine"],
      nfrs: ["NFR-05", "NFR-07", "NFR-09"],
      labels: ["ai"],
      dependsOn: ["Draft a cited reply for the agent", "Switch automation off per intent"],
    },
    {
      title: "Reopen when the customer says it isn't resolved",
      asA: "customer",
      iWant: "to reply 'not resolved' and reach a person with the history",
      soThat: "automation never traps me",
      criteria: [
        [
          "an auto-resolved case",
          "the customer replies within 14 days",
          "the case reopens for an agent with the full thread and the agent's reasoning",
        ],
      ],
      points: 3,
      components: ["servicenow-adapter", "reply-service"],
      nfrs: ["NFR-01"],
      dependsOn: ["Auto-resolve allow-listed intents"],
    },
  ],
  "BR-12": [
    {
      title: "Review panel in the agent console",
      asA: "agent",
      iWant:
        "the intent, evidence, extracted data and draft side by side with accept, edit, re-classify and reject",
      soThat: "I can trust and act on the agent's work in seconds",
      criteria: [
        ["a case with a draft", "I click Accept and send", "the reply is sent in no more than 2 clicks"],
        ["I re-classify a case", "I save", "I must pick a reason from the list"],
      ],
      points: 8,
      components: ["agent-console"],
      dependsOn: ["Draft a cited reply for the agent"],
    },
    {
      title: "Capture agent feedback as labelled examples",
      asA: "AI CoE lead",
      iWant: "every agent decision stored as a labelled example",
      soThat: "we can measure accuracy and improve the agent",
      criteria: [
        [
          "an agent edits a draft and sends it",
          "the case is saved",
          "the original, the sent text, edit distance and reason are stored",
        ],
      ],
      points: 3,
      components: ["agent-console", "analytics"],
      dependsOn: ["Review panel in the agent console"],
    },
  ],
  "BR-13": [
    {
      title: "Switch automation off per intent",
      asA: "support operations manager",
      iWant: "to change thresholds, edit the allow-list or pause automation within a minute",
      soThat: "I can stop the agent immediately if quality drops",
      criteria: [
        [
          "automation is on",
          "I press Pause all",
          "within 1 minute no automated replies are sent and emails go to human triage",
        ],
        [
          "a user without the support operations manager role",
          "they open the controls",
          "they can view but not change them",
        ],
      ],
      points: 5,
      components: ["policy-engine", "admin-console"],
      nfrs: ["NFR-06", "NFR-07"],
      labels: ["compliance"],
    },
  ],
  "BR-14": [
    {
      title: "Daily operations and accuracy dashboard",
      asA: "support operations manager",
      iWant:
        "volumes, accuracy, auto-resolution, CSAT, handling time and complaint timelines by intent and mailbox",
      soThat: "I can manage the service and prove the business case",
      criteria: [
        [
          "it is 09:00 IST",
          "I open the dashboard",
          "yesterday's data is there with each KPI against its baseline and target",
        ],
      ],
      points: 5,
      components: ["analytics"],
      dependsOn: ["Capture agent feedback as labelled examples"],
    },
    {
      title: "Weekly audited quality sample",
      asA: "AI CoE lead",
      iWant: "200 random emails a week sampled for human audit",
      soThat: "accuracy isn't judged only by agents' own feedback",
      criteria: [
        ["it is Monday", "the sampler runs", "200 emails stratified by intent are assigned to the QA team"],
      ],
      points: 3,
      components: ["analytics", "agent-console"],
    },
  ],
  "BR-15": [
    {
      title: "Classify and reply to Hindi emails",
      asA: "customer",
      iWant: "my Hindi or Hinglish email understood and answered in my language",
      soThat: "I get the same service as English speakers",
      criteria: [
        ["the 300-email Hindi gold set", "classification runs", "intent accuracy is at least 88%"],
        ["an email in Hindi", "a draft is prepared", "it is written in Hindi"],
      ],
      points: 5,
      components: ["triage-service", "reply-service"],
      labels: ["ai"],
    },
  ],
};
