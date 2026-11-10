import { z } from "zod";

/* ── Workspace assistant ─────────────────────────────────────────────────────────────────────────
 * One assistant available on every screen (panel, sheet or full page). It answers from the
 * workspace's own data, knows which page and project you are on, and links to where things are.
 */

/** Where the user is when they ask. Paths are relative to the workspace, e.g. "/projects/UPI". */
export const PageContext = z.object({
  label: z.string().max(200),
  path: z.string().startsWith("/").max(300),
  projectId: z.string().nullable(),
});
export type PageContext = z.infer<typeof PageContext>;

export const AssistantAction = z.object({
  label: z.string(),
  /** Workspace-relative path to open. */
  to: z.string().startsWith("/"),
});
export type AssistantAction = z.infer<typeof AssistantAction>;

export const AssistantSource = z.object({ label: z.string(), tool: z.string() });
export type AssistantSource = z.infer<typeof AssistantSource>;

export const AssistantMessage = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  /** Markdown for the assistant, plain text for the user. */
  text: z.string(),
  at: z.string(),
  via: z.enum(["text", "voice"]),
  /** Short version for reading aloud (assistant only). */
  speech: z.string().nullable(),
  sources: z.array(AssistantSource),
  actions: z.array(AssistantAction),
  /** Page the user was on, e.g. "Project UPI". */
  context: z.string().nullable(),
  /** Follow-up questions to offer next. */
  followUps: z.array(z.string()),
});
export type AssistantMessage = z.infer<typeof AssistantMessage>;

export const AssistantConversation = z.object({
  id: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  messages: z.array(AssistantMessage),
});
export type AssistantConversation = z.infer<typeof AssistantConversation>;

export const AssistantConversationList = z.object({
  items: z.array(
    z.object({ id: z.string(), title: z.string(), updatedAt: z.string(), count: z.number().int() }),
  ),
  /** Whether this workspace allows the browser's speech service, and why not. */
  voice: z.object({ allowed: z.boolean(), reason: z.string().nullable() }),
});
export type AssistantConversationList = z.infer<typeof AssistantConversationList>;

export const AssistantSend = z.object({
  conversationId: z.string().nullable(),
  text: z.string().trim().min(1).max(2000),
  via: z.enum(["text", "voice"]),
  context: PageContext.nullable(),
});
export type AssistantSend = z.infer<typeof AssistantSend>;
