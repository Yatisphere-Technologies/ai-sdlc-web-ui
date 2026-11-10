import {
  AssistantConversation,
  AssistantConversationList,
  type AssistantMessage,
  AssistantSend,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { apiError, guardTenant } from "../guard";
import type { TenantSeed } from "../seed/types";
import { respond, titleOf } from "./respond";

const T = "/api/t/:tenantId";
const isTest = import.meta.env.MODE === "test";
const now = () => new Date().toISOString();

export type AssistantStore = { conversations: AssistantConversation[]; seq: number };

const voice = (s: TenantSeed) => {
  const c = s.security.controls.find((x) => x.id === "browser-speech");
  return c?.enabled
    ? { allowed: true, reason: null }
    : {
        allowed: false,
        reason: "Your admin turned off browser voice for this workspace (audio would leave your region).",
      };
};

const list = (s: TenantSeed) =>
  AssistantConversationList.parse({
    items: [...s.assistant.conversations]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt, count: c.messages.length })),
    voice: voice(s),
  });

export const assistantHandlers = [
  http.get(`${T}/assistant/conversations`, async ({ request, params }) => {
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(list(g.store));
  }),

  http.get(`${T}/assistant/conversations/:id`, async ({ request, params }) => {
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const c = g.store.assistant.conversations.find((x) => x.id === params.id);
    return c
      ? HttpResponse.json(AssistantConversation.parse(c))
      : apiError(404, "not_found", "No such conversation");
  }),

  http.delete(`${T}/assistant/conversations/:id`, async ({ request, params }) => {
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const before = g.store.assistant.conversations.length;
    g.store.assistant.conversations = g.store.assistant.conversations.filter((c) => c.id !== params.id);
    if (g.store.assistant.conversations.length === before)
      return apiError(404, "not_found", "No such conversation");
    return HttpResponse.json(list(g.store));
  }),

  /** Adds the user's message and the assistant's reply; returns the whole conversation. */
  http.post(`${T}/assistant/messages`, async ({ request, params }) => {
    await delay(isTest ? 0 : 700);
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const body = AssistantSend.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Write a message up to 2,000 characters");
    const { conversationId, text, via, context } = body.data;
    if (via === "voice" && !voice(g.store).allowed)
      return apiError(403, "forbidden", "Voice is turned off for this workspace");
    const s = g.store.assistant;
    let c = conversationId ? s.conversations.find((x) => x.id === conversationId) : undefined;
    if (conversationId && !c) return apiError(404, "not_found", "No such conversation");
    if (!c) {
      c = { id: `cv-${++s.seq}`, title: titleOf(text), updatedAt: now(), messages: [] };
      s.conversations.push(c);
    }
    const at = now();
    const user: AssistantMessage = {
      id: `m-${++s.seq}`,
      role: "user",
      text,
      at,
      via,
      speech: null,
      sources: [],
      actions: [],
      context: context?.label ?? null,
      followUps: [],
    };
    const r = respond(g.store, text, context);
    const reply: AssistantMessage = {
      id: `m-${++s.seq}`,
      role: "assistant",
      text: r.text,
      at: now(),
      via,
      speech: r.speech,
      sources: r.sources,
      actions: r.actions,
      context: null,
      followUps: r.followUps,
    };
    c.messages.push(user, reply);
    c.updatedAt = reply.at;
    return HttpResponse.json(AssistantConversation.parse(c));
  }),
];
