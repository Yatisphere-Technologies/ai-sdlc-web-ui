import { Link } from "@tanstack/react-router";
import { Button, cn, Eyebrow } from "@throughline/ui";
import { MessageSquare, Plus, X } from "lucide-react";
import { useEffect } from "react";
import { useTenant } from "@/tenancy";
import { AssistantChat } from "./AssistantChat";
import { useAssistant } from "./AssistantContext";
import { AutoReadToggle, ConversationMenu } from "./AssistantPanel";
import { useConversations } from "./api";

function History() {
  const a = useAssistant();
  const list = useConversations().data?.items ?? [];
  return (
    <nav aria-label="Conversations" className="flex min-h-0 flex-col gap-2">
      <Button
        variant="secondary"
        size="sm"
        className="justify-start"
        onClick={() => a.setConversationId(null)}
      >
        <Plus className="size-4" aria-hidden /> New conversation
      </Button>
      <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => a.setConversationId(c.id)}
              aria-current={c.id === a.conversationId}
              className={cn(
                "text-body-sm flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left",
                c.id === a.conversationId
                  ? "bg-agent-wash text-strong"
                  : "text-subtle hover:bg-surface-raised hover:text-foreground",
              )}
            >
              <MessageSquare className="text-muted size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{c.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The assistant as a full page: history on the left on wide screens, the conversation filling the rest. */
export function AssistantPage({ conversation }: { conversation?: string }) {
  const { tenant } = useTenant();
  const a = useAssistant();
  // biome-ignore lint/correctness/useExhaustiveDependencies: open the conversation named in the URL once
  useEffect(() => {
    if (conversation) a.setConversationId(conversation);
    a.close();
  }, [conversation]);
  return (
    <div className="bg-surface fixed inset-0 z-40 grid min-h-0 grid-cols-1 lg:static lg:z-auto lg:-mx-9 lg:-mt-7 lg:-mb-24 lg:h-[calc(100dvh-4.3125rem)] lg:grid-cols-[16rem_minmax(0,1fr)] lg:bg-transparent">
      <aside className="border-line hidden min-h-0 flex-col gap-3 border-r p-4 lg:flex">
        <Eyebrow>Assistant · {tenant.name}</Eyebrow>
        <History />
      </aside>
      <AssistantChat
        header={
          <div className="border-line flex items-center gap-1 border-b px-3 py-2 lg:hidden">
            <span className="text-body-sm text-strong flex-1 px-1 font-semibold">Assistant</span>
            <ConversationMenu />
            <AutoReadToggle />
            <Button asChild variant="ghost" size="sm" className="size-9 px-0">
              <Link to="/t/$tenantSlug" params={{ tenantSlug: tenant.slug }} aria-label="Close the assistant">
                <X className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
