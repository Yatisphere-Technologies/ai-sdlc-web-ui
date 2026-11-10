import {
  type Backlog,
  type BacklogTarget,
  type Brd,
  type BrdApproval,
  type BrdContent,
  defaultLayout,
  isPushable,
} from "@throughline/contracts";
import { acmeBrdContent, acmeHints } from "./acmeBrd";
import { externalKey, generateBacklog } from "./backlog";
import {
  acmeComments,
  acmeSources,
  acmeThread,
  fabrikamThread,
  northwindSources,
  northwindThread,
} from "./conversations";
import { emailListenerBrdContent, emailListenerHints } from "./emailListenerBrd";
import { emailListenerComments, emailListenerSources, emailListenerThread } from "./emailListenerThread";
import { mcpGovernanceBrdContent, mcpGovernanceHints, mcpGovernanceThread } from "./mcpGovernanceBrd";
import { fabrikamBrdContent, northwindBrdContent, northwindHints } from "./otherBrds";
import type { BrdRecord, StoryHint } from "./types";

export { externalKey, generateBacklog } from "./backlog";
export type { BrdRecord } from "./types";

const approval = (
  id: string,
  capacity: string,
  name: string,
  isMe: boolean,
  done?: [string, string],
): BrdApproval => ({
  id,
  capacity,
  name,
  isMe,
  status: done ? "approved" : "pending",
  at: done?.[0] ?? null,
  comment: done?.[1] ?? null,
});

function record(opts: {
  brd: Omit<Brd, "content" | "layout" | "customSections"> & { content: BrdContent };
  hints: Record<string, StoryHint[]>;
  target: BacklogTarget;
  project: string;
  connected: boolean;
  generated?: { at: string; pushed?: { at: string; by: string } };
  sources?: BrdRecord["sources"];
  thread: BrdRecord["thread"];
  comments?: BrdRecord["comments"];
}): BrdRecord {
  const items = opts.generated ? generateBacklog(opts.brd.content, opts.hints, opts.brd.id) : [];
  if (opts.generated?.pushed) {
    let seq = 0;
    for (const it of items)
      if (isPushable(opts.target, it)) it.external = externalKey(opts.target, opts.project, ++seq);
  }
  const backlog: Backlog = {
    id: `bl-${opts.brd.id}`,
    brdId: opts.brd.id,
    brdVersion: opts.brd.version,
    status: opts.generated ? "ready" : "none",
    progress: opts.generated ? 100 : 0,
    generatedAt: opts.generated?.at ?? null,
    target: opts.target,
    project: opts.project,
    targetConnected: opts.connected,
    pushedAt: opts.generated?.pushed?.at ?? null,
    pushedBy: opts.generated?.pushed?.by ?? null,
    items,
  };
  return {
    brd: { ...opts.brd, layout: defaultLayout(), customSections: [] },
    sources: opts.sources ?? [],
    thread: opts.thread,
    comments: opts.comments ?? [],
    seq: 100,
    hints: opts.hints,
    backlog,
  };
}

export const acmeBrds = (): BrdRecord[] => [
  record({
    brd: {
      id: "BRD-40",
      projectId: "prj-sup",
      workItemKey: "INT-40",
      title: "Agentic email listener for support emails",
      version: "1.0",
      status: "approved",
      owner: "Priya Nair",
      author: "BA agent · with Priya Nair and Kavita Rao",
      submittedBy: "Priya Nair",
      updatedAt: "2026-10-20T10:10:00Z",
      content: emailListenerBrdContent,
      approvals: [
        approval("ap-sponsor", "Business sponsor", "Sanjay Menon", false, [
          "2026-10-19T12:05:00Z",
          "Approved. Decide OQ-2 in sprint 1.",
        ]),
        approval("ap-compliance", "Compliance", "Meera Iyer", false, [
          "2026-10-17T10:25:00Z",
          "RBI timelines, DPDP and audit retention are covered. OQ-3 to follow.",
        ]),
        approval("ap-security", "Information security", "Arjun Shah", false, [
          "2026-10-18T08:30:00Z",
          "Redaction, in-region processing and the red-team gate are what we need.",
        ]),
        approval("ap-ai", "AI governance", "Neha Gupta", false, [
          "2026-10-20T10:10:00Z",
          "Shadow mode, thresholds and the kill switch meet the AI CoE framework.",
        ]),
      ],
      history: [
        {
          version: "0.1",
          at: "2026-10-05T09:03:00Z",
          by: "BA agent",
          what: "Drafted from Priya's brief, the mailbox analysis (S1) and the shadow pilot report (S2)",
        },
        {
          version: "0.4",
          at: "2026-10-09T12:30:00Z",
          by: "BA agent · Priya Nair",
          what: "Compliance, CISO and AI governance requirements added from S3; scope and RACI agreed",
        },
        {
          version: "0.7",
          at: "2026-10-12T09:30:00Z",
          by: "Priya Nair",
          what: "Requirements complete (BR-01 to BR-16); BR-03 made testable",
        },
        {
          version: "0.9",
          at: "2026-10-16T15:30:00Z",
          by: "Priya Nair",
          what: "NFRs, data, risks added; submitted for approval",
        },
        {
          version: "1.0",
          at: "2026-10-20T10:10:00Z",
          by: "Approvers",
          what: "Approved by sponsor, compliance, information security and AI governance",
        },
      ],
    },
    hints: emailListenerHints,
    target: "jira",
    project: "SUP",
    connected: true,
    generated: { at: "2026-10-20T10:15:00Z" },
    sources: emailListenerSources(),
    thread: emailListenerThread(),
    comments: emailListenerComments(),
  }),
  record({
    brd: {
      id: "BRD-52",
      projectId: "prj-mcp",
      workItemKey: "INT-52",
      title: "MCP governance for AI agents",
      version: "1.0",
      status: "approved",
      owner: "Priya Nair",
      author: "BA agent · with Arjun Shah and Neha Gupta",
      submittedBy: "Priya Nair",
      updatedAt: "2026-10-21T16:40:00Z",
      content: mcpGovernanceBrdContent,
      approvals: [
        approval("ap-sponsor", "Business sponsor", "Sanjay Menon", false, [
          "2026-10-21T16:40:00Z",
          "Approved. BRD-40 goes live on this platform.",
        ]),
        approval("ap-security", "Information security", "Arjun Shah", false, [
          "2026-10-20T11:00:00Z",
          "Kill switch, no passthrough and fail-closed screening are what we need.",
        ]),
        approval("ap-compliance", "Compliance", "Meera Iyer", false, [
          "2026-10-20T15:30:00Z",
          "Audit fields and retention meet RBI expectations. OQ-3 to follow.",
        ]),
        approval("ap-ai", "AI governance", "Neha Gupta", false, [
          "2026-10-21T09:15:00Z",
          "Every agent has an identity and a sponsor. Approved.",
        ]),
      ],
      history: [
        {
          version: "0.1",
          at: "2026-10-08T09:01:00Z",
          by: "BA agent",
          what: "Drafted from the CISO workshop notes and the MCP inventory",
        },
        {
          version: "0.6",
          at: "2026-10-14T12:00:00Z",
          by: "Priya Nair",
          what: "Requirements BR-01 to BR-13, NFRs and data agreed with security and the AI CoE",
        },
        {
          version: "0.9",
          at: "2026-10-17T10:00:00Z",
          by: "Priya Nair",
          what: "Submitted for approval",
        },
        {
          version: "1.0",
          at: "2026-10-21T16:40:00Z",
          by: "Approvers",
          what: "Approved by sponsor, information security, compliance and AI governance",
        },
      ],
    },
    hints: mcpGovernanceHints,
    target: "jira",
    project: "MCP",
    connected: true,
    generated: { at: "2026-10-21T17:00:00Z" },
    thread: mcpGovernanceThread(),
  }),
  record({
    brd: {
      id: "BRD-31",
      projectId: "prj-upi",
      workItemKey: "INT-31",
      title: "UPI AutoPay mandate cancellation",
      version: "0.3",
      status: "in-review",
      owner: "Priya Nair",
      author: "BA agent · edited by Rahul Mehta",
      submittedBy: "Rahul Mehta",
      updatedAt: "2026-10-23T11:20:00Z",
      content: acmeBrdContent,
      approvals: [
        approval("ap-sponsor", "Business sponsor", "Anil Kapoor", false, [
          "2026-10-23T14:05:00Z",
          "Approved. Track OQ-2 to a decision before G1.",
        ]),
        approval("ap-compliance", "Compliance", "Meera Iyer", false, [
          "2026-10-24T06:40:00Z",
          "RBI localisation and audit retention are covered.",
        ]),
        approval("ap-po", "Product owner", "Priya Nair", true),
      ],
      history: [
        {
          version: "0.1",
          at: "2026-10-18T09:10:00Z",
          by: "BA agent",
          what: "Drafted from the G0 brief, 41 support tickets and the ops workshop notes",
        },
        {
          version: "0.2",
          at: "2026-10-21T16:30:00Z",
          by: "Rahul Mehta",
          what: "Added BR-08, split BR-04 acceptance criteria, resolved OQ-1",
        },
        { version: "0.3", at: "2026-10-23T11:20:00Z", by: "Rahul Mehta", what: "Submitted for approval" },
      ],
    },
    hints: acmeHints,
    target: "jira",
    project: "UPI",
    connected: true,
    sources: acmeSources(),
    thread: acmeThread(),
    comments: acmeComments(),
  }),
];

export const northwindBrds = (): BrdRecord[] => [
  record({
    brd: {
      id: "BRD-199",
      projectId: "prj-iso",
      workItemKey: "INT-199",
      title: "ISO 20022 pacs.008 migration",
      version: "1.0",
      status: "approved",
      owner: "Omar Haddad",
      author: "BA agent · edited by Omar Haddad",
      submittedBy: "Omar Haddad",
      updatedAt: "2026-10-16T08:00:00Z",
      content: northwindBrdContent,
      approvals: [
        approval("ap-sponsor", "Business sponsor", "Fatima Al Mansoori", false, [
          "2026-10-15T10:00:00Z",
          "Approved.",
        ]),
        approval("ap-compliance", "Compliance", "Layla Saeed", false, [
          "2026-10-15T13:20:00Z",
          "Sanctions screening rule added; fine.",
        ]),
        approval("ap-arch", "Architecture", "Priya Nair", true, [
          "2026-10-16T08:00:00Z",
          "Fits the payments hub target architecture.",
        ]),
      ],
      history: [
        {
          version: "0.1",
          at: "2026-10-09T09:00:00Z",
          by: "BA agent",
          what: "Drafted from the ISO 20022 programme brief",
        },
        { version: "0.4", at: "2026-10-14T12:00:00Z", by: "Omar Haddad", what: "Submitted for approval" },
        {
          version: "1.0",
          at: "2026-10-16T08:00:00Z",
          by: "Approvers",
          what: "Approved by sponsor, compliance and architecture",
        },
      ],
    },
    hints: northwindHints,
    target: "azure-boards",
    project: "Payments Hub",
    connected: true,
    generated: { at: "2026-10-16T08:30:00Z", pushed: { at: "2026-10-16T09:10:00Z", by: "Omar Haddad" } },
    sources: northwindSources(),
    thread: northwindThread(),
  }),
];

export const fabrikamBrds = (): BrdRecord[] => [
  record({
    brd: {
      id: "BRD-12",
      projectId: "prj-loy",
      workItemKey: "INT-12",
      title: "Loyalty points expiry",
      version: "0.2",
      status: "draft",
      owner: "Dana Whitfield",
      author: "BA agent",
      submittedBy: null,
      updatedAt: "2026-10-22T15:00:00Z",
      content: fabrikamBrdContent,
      approvals: [
        approval("ap-sponsor", "Business sponsor", "Unassigned", false),
        approval("ap-po", "Product owner", "Dana Whitfield", false),
      ],
      history: [
        {
          version: "0.1",
          at: "2026-10-20T10:00:00Z",
          by: "BA agent",
          what: "Drafted from the finance request",
        },
      ],
    },
    hints: {},
    target: "jira",
    project: "LOY",
    connected: true,
    thread: fabrikamThread(),
  }),
];
