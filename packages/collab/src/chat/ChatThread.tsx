import { cn } from "@throughline/ui";
import {
  Check,
  Copy,
  FileText,
  Link2,
  LoaderCircle,
  Quote,
  StickyNote,
  TriangleAlert,
  Volume2,
  VolumeX,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import type { ChatAttachment, ChatMessageView, Participant } from "../types";
import { useSpeaker } from "../voice/hooks";
import { Markdown, type TextTransform } from "./Markdown";
import { plainText } from "./parseMarkdown";

const KIND_ICON = { file: FileText, link: Link2, note: StickyNote, workspace: FileText } as const;

export function AttachmentChip({
  a,
  onRemove,
  onOpen,
}: {
  a: ChatAttachment;
  onRemove?: () => void;
  onOpen?: () => void;
}) {
  const Icon =
    a.status === "uploading" ? LoaderCircle : a.status === "failed" ? TriangleAlert : KIND_ICON[a.kind];
  const body = (
    <>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-md",
          a.status === "failed" ? "bg-risk-soft text-risk-fg" : "bg-ion-soft text-ion-fg",
        )}
      >
        <Icon className={cn("size-4", a.status === "uploading" && "animate-spin")} aria-hidden />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="text-caption text-foreground max-w-48 truncate font-semibold">{a.name}</span>
        <span className={cn("text-nano truncate", a.status === "failed" ? "text-risk-fg" : "text-faint")}>
          {a.status === "uploading" ? "Reading…" : (a.detail ?? a.kind)}
        </span>
      </span>
    </>
  );
  return (
    <span className="border-line bg-surface-raised relative flex items-center gap-2 rounded-lg border py-1.5 pr-2.5 pl-1.5">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex cursor-pointer items-center gap-2"
          title="Show source"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${a.name}`}
          className="bg-surface border-line text-muted hover:text-risk absolute -top-1.5 -right-1.5 grid size-4 cursor-pointer place-items-center rounded-full border"
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={done ? "Copied" : "Copy reply"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      className="text-faint hover:text-foreground hover:bg-surface-raised grid size-7 cursor-pointer place-items-center rounded-md"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

const reduceMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;

/** Reveals a reply word by word, like a streamed response; instant with reduced motion. */
function useReveal(text: string, enabled: boolean) {
  const words = text.split(/(\s+)/);
  const [shown, setShown] = useState(enabled && !reduceMotion() ? 0 : words.length);
  useEffect(() => {
    if (shown >= words.length) return;
    const step = Math.max(2, Math.ceil(words.length / 40));
    const t = setTimeout(() => setShown((n) => Math.min(words.length, n + step)), 24);
    return () => clearTimeout(t);
  }, [shown, words.length]);
  return { text: words.slice(0, shown).join(""), done: shown >= words.length };
}

type Speech = { speaking: boolean; toggle: () => void } | null;

function SpeakButton({ speech }: { speech: NonNullable<Speech> }) {
  return (
    <button
      type="button"
      aria-label={speech.speaking ? "Stop reading aloud" : "Read aloud"}
      aria-pressed={speech.speaking}
      onClick={speech.toggle}
      className={cn(
        "hover:bg-surface-raised grid size-7 cursor-pointer place-items-center rounded-md",
        speech.speaking ? "text-agent-fg" : "text-faint hover:text-foreground",
      )}
    >
      {speech.speaking ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
    </button>
  );
}

function AssistantMessage({
  m,
  agent,
  animate,
  transform,
  speech,
}: {
  m: ChatMessageView;
  agent: Participant;
  animate: boolean;
  transform?: TextTransform;
  speech: Speech;
}) {
  const { text, done } = useReveal(m.text, animate);
  return (
    <div className="group flex gap-3">
      <Avatar p={agent} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <Markdown
          text={text}
          transform={transform}
          className="text-body-sm text-foreground leading-relaxed"
        />
        {done && m.body ? <div className="animate-rise flex flex-col gap-2">{m.body}</div> : null}
        {done ? (
          <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 focus-within:opacity-100">
            <CopyButton text={plainText(m.text)} />
            {speech ? <SpeakButton speech={speech} /> : null}
            <time className="text-nano text-faint" dateTime={m.at}>
              {new Date(m.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </time>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function UserMessage({
  m,
  onOpenAttachment,
}: {
  m: ChatMessageView;
  onOpenAttachment?: (id: string) => void;
}) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {m.attachments?.length ? (
        <div className="flex flex-wrap justify-end gap-1.5">
          {m.attachments.map((a) => (
            <AttachmentChip
              key={a.id}
              a={a}
              onOpen={onOpenAttachment ? () => onOpenAttachment(a.id) : undefined}
            />
          ))}
        </div>
      ) : null}
      {m.context ? (
        <span className="text-caption text-muted flex max-w-[calc(100%-3rem)] items-start gap-1.5">
          <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{m.context}</span>
        </span>
      ) : null}
      {m.card ??
        (m.text ? (
          <div className="bg-surface-raised text-body-sm text-foreground max-w-[calc(100%-3rem)] rounded-2xl px-4 py-2.5 whitespace-pre-line">
            {m.text}
          </div>
        ) : null)}
    </div>
  );
}

/**
 * A conversation laid out like a modern assistant chat: your messages as bubbles on the right, the
 * agent's replies as full-width Markdown with copy, newest reply streamed in.
 */
export function ChatThread({
  messages,
  agent,
  pending,
  pendingLabel = "Thinking…",
  empty,
  transform,
  onOpenAttachment,
  readAloud = true,
  autoRead = false,
  className,
}: {
  messages: ChatMessageView[];
  agent: Participant;
  pending?: boolean;
  pendingLabel?: string;
  /** Shown when there are no messages yet. */
  empty?: ReactNode;
  transform?: TextTransform;
  onOpenAttachment?: (id: string) => void;
  /** Offer "Read aloud" on replies when the voice engine can speak. */
  readAloud?: boolean;
  /** Read new replies aloud as they arrive. */
  autoRead?: boolean;
  className?: string;
}) {
  const speaker = useSpeaker();
  const canRead = readAloud && speaker.canSpeak;
  const speechFor = (m: ChatMessageView): Speech =>
    canRead
      ? {
          speaking: speaker.speakingId === m.id,
          toggle: () =>
            speaker.speakingId === m.id ? speaker.stop() : speaker.speak(m.speech ?? m.text, m.id),
        }
      : null;
  // Messages that were already there when the thread opened render instantly; new replies stream.
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(messages.map((m) => m.id));
  const end = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const count = messages.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll when the number of messages or the pending state changes
  useEffect(() => {
    const box = scroller.current;
    box?.scrollTo?.({ top: box.scrollHeight, behavior: count > 1 ? "smooth" : "auto" });
  }, [count, pending]);

  // Read a newly arrived reply aloud when asked to.
  const last = messages[messages.length - 1];
  const lastFresh = last && last.role === "assistant" && !seen.current.has(last.id) ? last : null;
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (!autoRead || !speaker.canSpeak || !lastFresh || spoken.current === lastFresh.id) return;
    spoken.current = lastFresh.id;
    speaker.speak(lastFresh.speech ?? lastFresh.text, lastFresh.id);
  }, [autoRead, lastFresh, speaker]);

  return (
    <div ref={scroller} className={cn("relative min-h-0 flex-1 overflow-y-auto", className)}>
      <ol
        aria-live="polite"
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-3 py-5 sm:px-4 sm:py-6"
      >
        {messages.length === 0 && empty ? <li>{empty}</li> : null}
        {messages.map((m) => {
          const fresh = !seen.current?.has(m.id);
          return (
            <li key={m.id} className="flex flex-col gap-6">
              {m.divider ? (
                <div className="flex items-center gap-3" aria-hidden>
                  <span className="bg-line h-px flex-1" />
                  <span className="eyebrow text-faint">{m.divider}</span>
                  <span className="bg-line h-px flex-1" />
                </div>
              ) : null}
              {m.role === "assistant" ? (
                <AssistantMessage
                  m={m}
                  agent={agent}
                  animate={fresh}
                  transform={transform}
                  speech={speechFor(m)}
                />
              ) : (
                <UserMessage m={m} onOpenAttachment={onOpenAttachment} />
              )}
            </li>
          );
        })}
        {pending ? (
          <li className="flex items-center gap-3">
            <Avatar p={agent} />
            <span className="text-body-sm text-muted flex items-center gap-2">
              <span className="bg-working h-2 w-16 rounded-full" aria-hidden />
              {pendingLabel}
            </span>
          </li>
        ) : null}
      </ol>
      <div ref={end} aria-hidden />
    </div>
  );
}
