import type { ReactNode } from "react";

/* ── People and agents working on a document ───────────────────────────────────────────────── */

export type Participant = {
  id: string;
  name: string;
  kind: "human" | "agent";
  /** The signed-in user. */
  you?: boolean;
  /** Present in the document right now. */
  online?: boolean;
  /** Short role shown in the presence tooltip, e.g. "Compliance approver". */
  role?: string;
};

/** What a participant is doing right now, e.g. the agent drafting a section. */
export type Activity = { participantId: string; blockId: string | null; label: string };

/* ── Document ──────────────────────────────────────────────────────────────────────────────── */

/** Quick request to the agent from a block's menu, e.g. "Make it concise". */
export type BlockAction = { id: string; label: string; prompt: string };

export type DocBlock = {
  id: string;
  /** Rendered heading; pass an inline editor to make it renameable. */
  title: ReactNode;
  /** Plain title for menus and labels. */
  label: string;
  number?: number;
  content: ReactNode;
  /** Issues or hints shown under the heading. */
  issues?: ReactNode;
  actions?: BlockAction[];
  /** Marked in the margin, e.g. the sections the current step fills. */
  highlighted?: boolean;
};

/**
 * A change someone (usually the agent) proposed but nobody has accepted yet. With `before`/`after`
 * strings it shows as a tracked change; otherwise `detail` describes it.
 */
export type DocSuggestion = {
  id: string;
  blockId: string;
  /** Item inside the block, e.g. "BR-03". */
  rowId?: string | null;
  authorId: string;
  summary: string;
  before?: string | null;
  after?: string | null;
  detail?: ReactNode;
  cites?: string[];
};

export type ThreadMessage = {
  id: string;
  authorId: string;
  text: string;
  at: string;
  /** Extra content under the message, e.g. suggestions the agent attached. */
  detail?: ReactNode;
};

export type DocThread = {
  id: string;
  blockId: string;
  rowId?: string | null;
  /** The text the comment is about, if it was made on a selection. */
  quote?: string | null;
  resolved: boolean;
  messages: ThreadMessage[];
};

export type NewComment = {
  blockId: string;
  rowId?: string | null;
  quote?: string | null;
  text: string;
  /** Ask the agent to answer in the thread. */
  askAgent: boolean;
};

export type AgentAsk = { blockId: string; quote: string | null; prompt: string };

/* ── Chat ──────────────────────────────────────────────────────────────────────────────────── */

export type ChatAttachment = {
  id: string;
  name: string;
  kind: "file" | "link" | "note" | "workspace";
  status: "uploading" | "ready" | "linked" | "failed";
  /** Short status line, e.g. "12 passages" or why it failed. */
  detail?: string;
};

export type ChatMessageView = {
  id: string;
  role: "user" | "assistant";
  /** Markdown for the assistant, plain text for the user. */
  text: string;
  at: string;
  attachments?: ChatAttachment[];
  /** What the message refers to, e.g. a quoted passage of the document. */
  context?: string | null;
  /** Content after the text, e.g. proposed edits. */
  body?: ReactNode;
  /** Replaces the user bubble, e.g. a structured entry card. */
  card?: ReactNode;
  /** Label of a divider shown before this message, e.g. the step it starts. */
  divider?: string | null;
  /** What to say when read aloud, if different from the text (short, no Markdown). */
  speech?: string;
};
