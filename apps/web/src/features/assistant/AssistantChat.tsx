import { useRouter, useRouterState } from "@tanstack/react-router";
import { Chat, type ChatMessageView, type Participant, type Starter } from "@throughline/collab";
import type { AssistantMessage, PageContext } from "@throughline/contracts";
import { Button, toast } from "@throughline/ui";
import { ArrowUpRight, BarChart3, ClipboardList, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrandLogo, brandOf } from "@/components/brand";
import { usePortfolioQuery, useProjectScope } from "@/features/projects";
import { useTenant } from "@/tenancy";
import { useAssistant } from "./AssistantContext";
import { useConversation, useSendMessage } from "./api";
import { routeContext, workspacePath } from "./pageContext";
import { useAutoRead } from "./voice";

const AGENT: Participant = { id: "assistant", name: "Assistant", kind: "agent" };

/** Where the user is right now, as the assistant should understand it. */
export function useCurrentContext(): PageContext {
  const { tenant } = useTenant();
  const { page } = useAssistant();
  const href = useRouterState({ select: (s) => s.location.href });
  const [scope] = useProjectScope(tenant.id);
  const projects = usePortfolioQuery().data?.projects ?? [];
  const key = projects.find((p) => p.id === scope)?.key ?? null;
  return page ?? routeContext(workspacePath(href, tenant.slug), scope, key);
}

function startersFor(ctx: PageContext): Starter[] {
  const icon = (n: ReactNode) => n;
  if (ctx.projectId)
    return [
      { label: "Summarise", prompt: "Summarise this project", icon: icon(<Sparkles className="size-4" />) },
      {
        label: "Risks",
        prompt: "What's blocking this project?",
        icon: icon(<TriangleAlert className="size-4" />),
      },
      {
        label: "Testing",
        prompt: "How is testing going on this project?",
        icon: icon(<ClipboardList className="size-4" />),
      },
      { label: "My queue", prompt: "What's waiting on me?", icon: icon(<BarChart3 className="size-4" />) },
    ];
  return [
    { label: "My queue", prompt: "What's waiting on me?", icon: icon(<BarChart3 className="size-4" />) },
    {
      label: "At risk",
      prompt: "Which projects are at risk?",
      icon: icon(<TriangleAlert className="size-4" />),
    },
    {
      label: "Test plans",
      prompt: "How are the test plans looking?",
      icon: icon(<ClipboardList className="size-4" />),
    },
    {
      label: "Security",
      prompt: "What should I fix in security?",
      icon: icon(<ShieldCheck className="size-4" />),
    },
  ];
}

function Extras({ m, onOpen }: { m: AssistantMessage; onOpen: (to: string) => void }) {
  if (!m.actions.length && !m.sources.length) return null;
  return (
    <div className="flex flex-col gap-2">
      {m.actions.length ? (
        <div className="flex flex-wrap gap-1.5">
          {m.actions.map((a) => (
            <Button key={a.to} size="sm" variant="secondary" className="h-8" onClick={() => onOpen(a.to)}>
              {a.label} <ArrowUpRight className="size-3.5" aria-hidden />
            </Button>
          ))}
        </div>
      ) : null}
      {m.sources.length ? (
        <div className="text-caption text-muted flex flex-wrap items-center gap-1.5">
          Sources
          {m.sources.map((s) => (
            <span
              key={`${s.tool}-${s.label}`}
              className="border-line flex items-center gap-1 rounded-xs border px-1.5 py-0.5"
            >
              {brandOf(s.tool) ? <BrandLogo brand={s.tool} size="xs" className="border-0" /> : null}
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The workspace assistant conversation, shared by the side panel and the full page. Sends with the
 * current page as context and turns reply actions into in-app navigation.
 */
export function AssistantChat({
  compact = false,
  header,
  onNavigate,
}: {
  compact?: boolean;
  header?: ReactNode;
  /** Called after an action link opens a page (e.g. to close a mobile sheet). */
  onNavigate?: () => void;
}) {
  const { tenant } = useTenant();
  const router = useRouter();
  const a = useAssistant();
  const ctx = useCurrentContext();
  const conversation = useConversation(a.conversationId);
  const send = useSendMessage();
  const [autoRead] = useAutoRead();
  const [optimistic, setOptimistic] = useState<ChatMessageView | null>(null);

  const open = useCallback(
    (to: string) => {
      router.history.push(`/t/${tenant.slug}${to}`);
      onNavigate?.();
    },
    [router, tenant.slug, onNavigate],
  );

  const messages: AssistantMessage[] = a.conversationId ? (conversation.data?.messages ?? []) : [];
  const views = useMemo<ChatMessageView[]>(
    () => [
      ...messages.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        at: m.at,
        context: m.role === "user" && m.context ? `On ${m.context}` : null,
        speech: m.speech ?? undefined,
        body: m.role === "assistant" ? <Extras m={m} onOpen={open} /> : undefined,
      })),
      ...(optimistic ? [optimistic] : []),
    ],
    [messages, optimistic, open],
  );
  const lastReply = [...messages].reverse().find((m) => m.role === "assistant");

  const submit = async (text: string, via: "text" | "voice", context: PageContext | null = ctx) => {
    setOptimistic({
      id: "optimistic",
      role: "user",
      text,
      at: new Date().toISOString(),
      context: context ? `On ${context.label}` : null,
    });
    try {
      const c = await send.mutateAsync({ conversationId: a.conversationId, text, via, context });
      a.setConversationId(c.id);
      const reply = c.messages[c.messages.length - 1];
      return reply?.speech ?? reply?.text ?? null;
    } catch (e) {
      toast.error("The assistant couldn't answer", {
        description: e instanceof Error ? e.message : undefined,
      });
      return null;
    } finally {
      setOptimistic(null);
    }
  };

  // A prompt handed over by useAssistant().open({ prompt }).
  const took = useRef(false);
  useEffect(() => {
    if (took.current || !a.pending) return;
    const p = a.takePending();
    if (p) {
      took.current = true;
      void submit(p.prompt, "text", p.context ?? ctx).finally(() => {
        took.current = false;
      });
    }
  });

  return (
    <Chat
      compact={compact}
      header={header}
      messages={views}
      agent={AGENT}
      pending={send.isPending}
      pendingLabel="Reading your workspace…"
      onSend={(text, _ids, via) => submit(text, via)}
      autoRead={autoRead}
      home={{
        title: "How can I help?",
        subtitle: `Ask about anything in ${tenant.name}. I know you're on ${ctx.label}.`,
      }}
      starters={startersFor(ctx)}
      suggestions={lastReply?.followUps ?? []}
      placeholder={`Ask about ${ctx.label}…`}
      voiceTitle={`Assistant · ${tenant.name}`}
    />
  );
}
