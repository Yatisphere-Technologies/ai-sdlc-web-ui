import { Link, useRouterState } from "@tanstack/react-router";
import { useListenBlocked } from "@throughline/collab";
import {
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
} from "@throughline/ui";
import { History, Maximize2, Plus, Sparkles, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { useEffect } from "react";
import { useTenant } from "@/tenancy";
import { AssistantChat, useCurrentContext } from "./AssistantChat";
import { useAssistant } from "./AssistantContext";
import { useConversations, useDeleteConversation } from "./api";
import { useAutoRead } from "./voice";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  return `${Math.round(m / 1440)} d`;
};

/** History of conversations, new chat and delete; used in the panel header and on the page. */
export function ConversationMenu({ align = "end" }: { align?: "start" | "end" }) {
  const a = useAssistant();
  const list = useConversations().data?.items ?? [];
  const del = useDeleteConversation();
  return (
    <Menu>
      <Tooltip content="Conversations">
        <MenuTrigger asChild>
          <Button variant="ghost" size="sm" className="size-9 px-0" aria-label="Conversation history">
            <History className="size-4" aria-hidden />
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent align={align} className="max-h-96 w-80 overflow-y-auto">
        <MenuItem onSelect={() => a.setConversationId(null)}>
          <Plus className="text-muted size-4" aria-hidden /> New conversation
        </MenuItem>
        {list.length ? (
          <>
            <MenuSeparator />
            <MenuLabel>Recent</MenuLabel>
          </>
        ) : null}
        {list.map((c) => (
          <MenuItem
            key={c.id}
            onSelect={() => a.setConversationId(c.id)}
            className={cn(c.id === a.conversationId && "bg-agent-wash")}
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{c.title}</span>
              <span className="text-caption text-faint">
                {c.count} messages · {ago(c.updatedAt)}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Delete “${c.title}”`}
              className="text-faint hover:text-risk-fg grid size-7 cursor-pointer place-items-center rounded-md"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                del.mutate(c.id);
                if (c.id === a.conversationId) a.setConversationId(null);
              }}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function AutoReadToggle() {
  const [on, set] = useAutoRead();
  const blocked = useListenBlocked();
  return (
    <Tooltip content={on ? "Stop reading replies aloud" : "Read replies aloud"}>
      <Button
        variant="ghost"
        size="sm"
        className={cn("size-9 px-0", on && "text-agent-fg")}
        aria-label="Read replies aloud"
        aria-pressed={on}
        disabled={Boolean(blocked)}
        onClick={() => set(!on)}
      >
        {on ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
      </Button>
    </Tooltip>
  );
}

/**
 * The assistant on every screen: a right-hand sheet on tablets and desktops, full screen on phones.
 * Escape closes it (unless voice mode is open on top).
 */
export function AssistantPanel() {
  const { tenant } = useTenant();
  const a = useAssistant();
  const ctx = useCurrentContext();
  const onAskPage = useRouterState({ select: (s) => /\/t\/[^/]+\/ask/.test(s.location.pathname) });

  useEffect(() => {
    if (!a.isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[aria-modal="true"]')) a.close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [a.isOpen, a.close]);

  if (!a.isOpen || onAskPage) return null;
  return (
    <section
      aria-label="Assistant"
      className="bg-surface border-line shadow-lift animate-rise fixed inset-0 z-40 flex flex-col sm:inset-y-0 sm:right-0 sm:left-auto sm:w-full sm:max-w-md sm:border-l lg:max-w-lg"
    >
      <AssistantChat
        compact
        onNavigate={() => {
          if (window.matchMedia("(max-width: 639px)").matches) a.close();
        }}
        header={
          <header className="border-line flex items-center gap-1 border-b px-3 py-2">
            <span className="bg-agent-soft text-agent-fg grid size-8 shrink-0 place-items-center rounded-full">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col px-1.5">
              <span className="text-body-sm text-strong font-semibold">Assistant</span>
              <span className="text-caption text-muted truncate">On {ctx.label}</span>
            </span>
            <Tooltip content="New conversation">
              <Button
                variant="ghost"
                size="sm"
                className="size-9 px-0"
                aria-label="New conversation"
                onClick={() => a.setConversationId(null)}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </Tooltip>
            <ConversationMenu />
            <AutoReadToggle />
            <Tooltip content="Open full page">
              <Button asChild variant="ghost" size="sm" className="hidden size-9 px-0 sm:grid">
                <Link
                  to="/t/$tenantSlug/ask"
                  params={{ tenantSlug: tenant.slug }}
                  aria-label="Open the assistant full page"
                  onClick={() => a.close()}
                >
                  <Maximize2 className="size-4" aria-hidden />
                </Link>
              </Button>
            </Tooltip>
            <Tooltip content="Close" shortcut="Esc">
              <Button
                variant="ghost"
                size="sm"
                className="size-9 px-0"
                aria-label="Close assistant"
                onClick={a.close}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </Tooltip>
          </header>
        }
      />
    </section>
  );
}

/** Floating button that opens the assistant, plus the ⌘J / Ctrl+J shortcut. */
export function AssistantLauncher() {
  const a = useAssistant();
  const onAskPage = useRouterState({ select: (s) => /\/t\/[^/]+\/ask/.test(s.location.pathname) });
  const mac = typeof navigator !== "undefined" && /Mac|iP(hone|ad)/.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        a.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [a.toggle]);

  if (a.isOpen || onAskPage) return null;
  return (
    <Tooltip content="Ask the assistant" shortcut={mac ? "⌘J" : "Ctrl J"} side="left">
      <button
        type="button"
        onClick={() => a.open()}
        aria-label="Open the assistant"
        aria-keyshortcuts={mac ? "Meta+J" : "Control+J"}
        className="bg-agent text-agent-ink shadow-lift hover-lift fixed right-4 bottom-4 z-30 flex h-12 cursor-pointer items-center gap-2 rounded-full px-4 sm:right-6 sm:bottom-6"
      >
        <Sparkles className="size-5" aria-hidden />
        <span className="text-body-sm hidden font-semibold sm:inline">Ask</span>
      </button>
    </Tooltip>
  );
}
