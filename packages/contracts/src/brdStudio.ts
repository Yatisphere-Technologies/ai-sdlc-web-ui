import { z } from "zod";
import { BrdApproval, BrdContent, BrdLayout, Brd as BrdSchemaRef, CustomSection } from "./brd";
import { DocNodeSchema } from "./brdDoc";

/* ── Reference sources the BA agent can read and cite ──────────────────────────────────────── */

export const SourceKind = z.enum(["link", "file", "note", "workspace"]);
export type SourceKind = z.infer<typeof SourceKind>;

export const SourcePassage = z.object({ id: z.string(), text: z.string() });
export type SourcePassage = z.infer<typeof SourcePassage>;

export const BrdSource = z.object({
  /** Citation id, e.g. "S2". Passages are "S2.1", "S2.2"… */
  id: z.string(),
  kind: SourceKind,
  title: z.string(),
  /** URL, file name or workspace reference. */
  origin: z.string(),
  mimeType: z.string().nullable(),
  size: z.number().nullable(),
  /** ready = text read; linked = saved but not readable here; failed = could not read. */
  status: z.enum(["ready", "linked", "failed"]),
  summary: z.string(),
  passages: z.array(SourcePassage),
  findings: z.object({ needs: z.number(), numbers: z.number(), terms: z.number() }),
  addedBy: z.string(),
  addedAt: z.string(),
});
export type BrdSource = z.infer<typeof BrdSource>;
export const BrdSourceList = z.object({ items: z.array(BrdSource) });
export type BrdSourceList = z.infer<typeof BrdSourceList>;

const MAX_TEXT = 400_000;

export const AddSource = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("link"),
    url: z.url({ protocol: /^https?$/ }),
    title: z.string().max(200).optional(),
    /** Text the user pasted from the page, if any; the agent reads it in place of fetching. */
    excerpt: z.string().max(MAX_TEXT).optional(),
  }),
  z.object({
    kind: z.literal("file"),
    fileName: z.string().min(1).max(255),
    mimeType: z.string().max(200),
    size: z
      .number()
      .int()
      .nonnegative()
      .max(25 * 1024 * 1024),
    /** Text extracted in the browser; null when the format could not be read. */
    text: z.string().max(MAX_TEXT).nullable(),
  }),
  z.object({
    kind: z.literal("note"),
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(MAX_TEXT),
  }),
  z.object({ kind: z.literal("workspace"), ref: z.string().min(1).max(100) }),
]);
export type AddSource = z.infer<typeof AddSource>;

/** Documents already in the platform (briefs, architecture packs, other BRDs) that can be attached. */
export const WorkspaceDoc = z.object({
  ref: z.string(),
  title: z.string(),
  kind: z.string(),
  description: z.string(),
});
export type WorkspaceDoc = z.infer<typeof WorkspaceDoc>;
export const WorkspaceDocList = z.object({ items: z.array(WorkspaceDoc) });

/* ── Anchors: what a message or comment is about ─────────────────────────────────────────── */

export const Anchor = z.object({
  /** Section id from BRD_SECTION_IDS, or a custom section id. */
  section: z.string().min(1).max(60),
  /** Item inside the section, e.g. "BR-03". */
  rowId: z.string().max(60).nullable(),
  /** Selected text the request is about. */
  quote: z.string().max(2000).nullable(),
});
export type Anchor = z.infer<typeof Anchor>;

/* ── Conversation ──────────────────────────────────────────────────────────────────────────── */

/**
 * A change the agent proposes to the document. Nothing changes until the author accepts it, so the
 * author stays the one writing the BRD.
 */
export const Proposal = z.object({
  id: z.string(),
  summary: z.string(),
  op: z.enum(["set-text", "add-row", "update-row", "remove-row", "add-items"]),
  /** BrdContent key, e.g. "requirements" or "outOfScope". */
  target: z.string(),
  rowId: z.string().nullable(),
  value: z.unknown(),
  cites: z.array(z.string()),
  /** reverted = applied live by the agent, then undone. */
  status: z.enum(["pending", "accepted", "rejected", "reverted"]),
  /** For an edit the agent applied live: the field before and after, so it can be undone. */
  undo: z.object({ before: z.unknown(), after: z.unknown() }).nullable().optional(),
  /** Who decided, and when. */
  decidedBy: z.string().nullable().optional(),
  decidedAt: z.string().nullable().optional(),
});
export type Proposal = z.infer<typeof Proposal>;

export const ChatMessage = z.object({
  id: z.string(),
  role: z.enum(["user", "agent"]),
  text: z.string(),
  at: z.string(),
  cites: z.array(z.string()),
  proposals: z.array(Proposal),
  /** Quick replies the author can tap. */
  suggestions: z.array(z.string()),
  /** Guided step the message belongs to, for step dividers in the conversation. */
  step: z.string().nullable().optional(),
  /** Structured capture the author submitted, shown as a card instead of a bubble. */
  capture: z.record(z.string(), z.unknown()).nullable().optional(),
  /** Sources attached to this message (ids like "S4"). */
  attachments: z.array(z.string()).optional(),
  /** Part of the document the message is about. */
  context: Anchor.nullable().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessage>;

export const BrdThread = z.object({
  brdId: z.string(),
  messages: z.array(ChatMessage),
  /** Section the agent is currently asking about. */
  focus: z.string().nullable(),
  /** Guided step the author is on; the agent keeps its questions inside it. */
  step: z.string().nullable().default(null),
  /** Optional questions the author chose to skip, so the agent doesn't ask them again. */
  skipped: z.array(z.string()).default([]),
  /** "simulated" until a model-backed agent is connected. */
  agent: z.enum(["simulated", "model"]),
  /** The agent writes into the document as it talks (each edit can be undone); off = it proposes and waits. */
  autoApply: z.boolean().default(true),
});
export type BrdThread = z.infer<typeof BrdThread>;

export const PostMessage = z
  .object({
    text: z.string().trim().max(4000),
    attachments: z.array(z.string().max(20)).max(10).default([]),
    context: Anchor.nullable().default(null),
  })
  .refine((m) => m.text.length > 0 || m.attachments.length > 0, {
    message: "Write a message or attach something",
  });
export type PostMessage = z.infer<typeof PostMessage>;

export const ProposalDecision = z.object({ decision: z.enum(["accept", "reject", "undo"]) });
export const AgentMode = z.object({ autoApply: z.boolean() });
export type ProposalDecision = z.infer<typeof ProposalDecision>;

/* ── Comments ──────────────────────────────────────────────────────────────────────────────── */

export const CommentMessage = z.object({
  id: z.string(),
  author: z.string(),
  role: z.enum(["human", "agent"]),
  text: z.string(),
  at: z.string(),
  /** Changes the agent proposed in its reply; decided like any other proposal. */
  proposals: z.array(Proposal),
});
export type CommentMessage = z.infer<typeof CommentMessage>;

export const CommentThread = z.object({
  id: z.string(),
  anchor: Anchor,
  resolved: z.boolean(),
  resolvedBy: z.string().nullable(),
  messages: z.array(CommentMessage).min(1),
});
export type CommentThread = z.infer<typeof CommentThread>;

export const NewComment = z.object({
  anchor: Anchor,
  text: z.string().trim().min(1).max(2000),
  /** Ask the BA agent to answer in the thread. */
  askAgent: z.boolean().default(false),
});
export type NewComment = z.infer<typeof NewComment>;

export const CommentReply = z.object({
  text: z.string().trim().min(1).max(2000),
  askAgent: z.boolean().default(false),
});
export type CommentReply = z.infer<typeof CommentReply>;

export const ResolveComment = z.object({ resolved: z.boolean() });

/* ── Editing the whole document ────────────────────────────────────────────────────────────── */

export const BrdDocUpdate = z.object({
  title: z.string().trim().min(3).max(200),
  owner: z.string().trim().min(1).max(100),
  workItemKey: z.string().trim().max(40),
  content: BrdContent,
  layout: BrdLayout,
  customSections: z.array(CustomSection).max(30),
  /** The rich-text document. When sent, the server derives content, layout and custom sections from it. */
  body: DocNodeSchema.optional(),
  /** Approvers can be added, removed or renamed while the BRD is a draft. */
  approvals: z
    .array(BrdApproval.pick({ id: true, capacity: true, name: true }))
    .min(1)
    .max(10),
});
export type BrdDocUpdate = z.infer<typeof BrdDocUpdate>;

export const NewBrd = z.object({
  /** Optional: without one, the title comes from the first message. */
  title: z.string().trim().min(3).max(200).optional(),
  /** The author's first message, used to name the BRD when there's no title. */
  titleFrom: z.string().max(8000).optional(),
  workItemKey: z.string().trim().max(40).optional(),
  /** The project the BRD belongs to. Required: a BRD without a project can't be tracked. */
  projectId: z.string().min(1),
  /** What the author typed to start; the agent drafts from it. */
  brief: z.string().max(8000).optional(),
});
export type NewBrd = z.infer<typeof NewBrd>;

/** Everything the studio shows for one BRD, returned by every studio call so the screen stays in sync. */
export const StudioState = z.object({
  brd: BrdSchemaRef,
  thread: BrdThread,
  sources: z.array(BrdSource),
  comments: z.array(CommentThread).default([]),
});
export type StudioState = z.infer<typeof StudioState>;
