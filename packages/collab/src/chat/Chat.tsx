import { cn } from "@throughline/ui";
import { type ComponentProps, type ReactNode, useState } from "react";
import type { ChatMessageView, Participant } from "../types";
import { VoiceMode } from "../voice/VoiceMode";
import { ChatHome, type Starter } from "./ChatHome";
import { ChatThread } from "./ChatThread";
import { Composer } from "./Composer";

/**
 * Sends a message. Resolve to the reply's text (Markdown is fine) so voice mode can read it out;
 * resolve to nothing if the reply arrives some other way.
 */
export type ChatSend = (
  text: string,
  attachmentIds: string[],
  via: "text" | "voice",
) => Promise<string | null | undefined> | undefined;

type ComposerExtras = Omit<
  ComponentProps<typeof Composer>,
  "value" | "onChange" | "onSend" | "sending" | "voice" | "onVoiceMode" | "suggestions" | "onSuggestion"
>;

/**
 * A complete conversation surface: an opening screen with starters, the thread, a composer with
 * attachments and dictation, read-aloud, and hands-free voice mode. Fills its container, so it
 * works as a page, a side panel or a mobile sheet. Domain-free: the host supplies messages and
 * `onSend`.
 */
export function Chat({
  messages,
  agent,
  onSend,
  pending = false,
  pendingLabel,
  home,
  starters = [],
  suggestions = [],
  voice = true,
  autoRead = false,
  compact = false,
  placeholder = "Message",
  composer,
  header,
  className,
  transform,
  onOpenAttachment,
  voiceTitle,
}: {
  messages: ChatMessageView[];
  agent: Participant;
  onSend: ChatSend;
  pending?: boolean;
  pendingLabel?: string;
  /** Opening screen; without it an empty thread shows the composer only. */
  home?: { title: string; subtitle?: string; kind?: ReactNode };
  starters?: Starter[];
  /** Quick follow-ups shown above the composer once the conversation started. */
  suggestions?: string[];
  /** Mic, read-aloud and hands-free voice mode. */
  voice?: boolean;
  autoRead?: boolean;
  /** Tighter layout for side panels and sheets. */
  compact?: boolean;
  placeholder?: string;
  /** Pass-through Composer options: attachments, files, links, menu, context, panel, footer. */
  composer?: ComposerExtras;
  /** Sticky bar above the conversation (title, actions). */
  header?: ReactNode;
  className?: string;
  transform?: ComponentProps<typeof ChatThread>["transform"];
  onOpenAttachment?: (id: string) => void;
  voiceTitle?: string;
}) {
  const [draft, setDraft] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const send = (text: string, ids: string[] = []) => {
    if (!text.trim() && !ids.length) return;
    setDraft("");
    void onSend(text, ids, "text");
  };
  const box = (
    <Composer
      {...composer}
      value={draft}
      onChange={setDraft}
      onSend={send}
      sending={pending}
      placeholder={placeholder}
      voice={voice}
      onVoiceMode={voice ? () => setVoiceOpen(true) : undefined}
      suggestions={messages.length ? suggestions : []}
      onSuggestion={(s) => send(s)}
    />
  );
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {header}
      {messages.length === 0 && home ? (
        <ChatHome
          compact={compact}
          title={home.title}
          subtitle={home.subtitle}
          kind={home.kind}
          composer={box}
          starters={starters}
          onStarter={(s) => send(s.prompt)}
        />
      ) : (
        <>
          <ChatThread
            messages={messages}
            agent={agent}
            pending={pending}
            pendingLabel={pendingLabel}
            transform={transform}
            onOpenAttachment={onOpenAttachment}
            readAloud={voice}
            autoRead={voice && autoRead}
          />
          <div className={cn("mx-auto w-full max-w-3xl", compact ? "px-3 pb-3" : "px-3 pb-4 sm:px-4")}>
            {box}
          </div>
        </>
      )}
      {voice ? (
        <VoiceMode
          open={voiceOpen}
          onClose={() => setVoiceOpen(false)}
          title={voiceTitle ?? agent.name}
          agentName={agent.name}
          respond={async (text) => {
            const r = await onSend(text, [], "voice");
            return typeof r === "string" ? r : null;
          }}
        />
      ) : null}
    </div>
  );
}
