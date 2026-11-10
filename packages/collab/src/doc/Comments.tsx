import { Button, cn } from "@throughline/ui";
import { CheckCheck, ChevronDown, MessageSquare, Quote, RotateCcw, Sparkles } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Avatar } from "../Avatar";
import type { DocThread, Participant } from "../types";

const time = (at: string) =>
  new Date(at).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** "@agent" anywhere in a comment asks the agent to answer it. */
export const mentionsAgent = (text: string) => /@(agent|ba\b|ba agent)/i.test(text);

export function CommentBox({
  quote,
  placeholder = "Comment, or @agent to ask the agent",
  submitLabel = "Comment",
  busy,
  agentName = "agent",
  onSubmit,
  onCancel,
  autoFocus,
}: {
  quote?: string | null;
  placeholder?: string;
  submitLabel?: string;
  busy?: boolean;
  agentName?: string;
  onSubmit: (text: string, askAgent: boolean) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const [ask, setAsk] = useState(false);
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    onSubmit(t, ask || mentionsAgent(t));
    setText("");
    setAsk(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      {quote ? (
        <span className="border-line text-caption text-muted flex items-start gap-1.5 border-l-2 pl-2">
          <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span className="line-clamp-2">{quote}</span>
        </span>
      ) : null}
      <textarea
        aria-label={placeholder}
        // biome-ignore lint/a11y/noAutofocus: opened on purpose by the comment button
        autoFocus={autoFocus}
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e);
          if (e.key === "Escape") onCancel?.();
        }}
        className="border-line bg-surface-sunken text-body-sm focus:border-agent field-sizing-content max-h-48 min-h-16 resize-none rounded-md border px-3 py-2 outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          htmlFor={`${id}-ask`}
          className="text-caption text-muted flex cursor-pointer items-center gap-1.5"
        >
          <input
            id={`${id}-ask`}
            type="checkbox"
            checked={ask || mentionsAgent(text)}
            onChange={(e) => setAsk(e.target.checked)}
            className="accent-agent"
          />
          <Sparkles className="text-agent size-3.5" aria-hidden /> Ask {agentName} to answer
        </label>
        <div className="flex gap-1.5">
          {onCancel ? (
            <Button size="sm" variant="ghost" type="button" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button size="sm" type="submit" disabled={!text.trim() || busy}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ThreadCard({
  t,
  people,
  canComment,
  busy,
  agentName,
  onReply,
  onResolve,
  defaultOpen = false,
}: {
  t: DocThread;
  people: Map<string, Participant>;
  canComment: boolean;
  busy?: boolean;
  agentName?: string;
  onReply?: (threadId: string, text: string, askAgent: boolean) => void;
  onResolve?: (threadId: string, resolved: boolean) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const first = t.messages[0];
  const replies = t.messages.length - 1;
  return (
    <article
      id={`thread-${t.id}`}
      aria-label={`Comment thread${t.rowId ? ` on ${t.rowId}` : ""}`}
      className={cn(
        "bg-surface-raised flex scroll-mt-24 flex-col gap-2 rounded-lg border px-3 py-2.5",
        t.resolved ? "border-line opacity-70" : "border-gate-line",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-start gap-2 text-left"
      >
        <Avatar p={first ? people.get(first.authorId) : undefined} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-caption text-muted">
            <span className="text-foreground font-semibold">
              {people.get(first?.authorId ?? "")?.name ?? "Someone"}
            </span>
            {first ? ` · ${time(first.at)}` : ""}
            {t.rowId ? ` · ${t.rowId}` : ""}
            {t.resolved ? " · resolved" : ""}
          </span>
          {t.quote && !open ? (
            <span className="text-caption text-faint line-clamp-1 italic">“{t.quote}”</span>
          ) : null}
          <span className={cn("text-body-sm text-foreground", !open && "line-clamp-2")}>{first?.text}</span>
          {!open && replies > 0 ? (
            <span className="text-caption text-agent-fg flex items-center gap-1">
              <MessageSquare className="size-3" aria-hidden /> {replies} {replies === 1 ? "reply" : "replies"}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn("text-faint mt-1 size-4 transition-transform", !open && "-rotate-90")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="flex flex-col gap-3 pl-8">
          {t.quote ? (
            <span className="border-line text-caption text-muted border-l-2 pl-2 italic">“{t.quote}”</span>
          ) : null}
          {first?.detail}
          {t.messages.slice(1).map((m) => {
            const p = people.get(m.authorId);
            return (
              <div key={m.id} className="flex gap-2">
                <Avatar p={p} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-caption text-muted">
                    <span className="text-foreground font-semibold">{p?.name ?? "Someone"}</span> ·{" "}
                    {time(m.at)}
                  </span>
                  <p className="text-body-sm text-foreground whitespace-pre-line">{m.text}</p>
                  {m.detail}
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-2">
            {canComment && !t.resolved && onReply ? (
              <CommentBox
                placeholder="Reply, or @agent"
                submitLabel="Reply"
                busy={busy}
                agentName={agentName}
                onSubmit={(text, ask) => onReply(t.id, text, ask)}
              />
            ) : null}
            {canComment && onResolve ? (
              <Button
                size="sm"
                variant="ghost"
                className="self-start"
                disabled={busy}
                onClick={() => onResolve(t.id, !t.resolved)}
              >
                {t.resolved ? (
                  <>
                    <RotateCcw className="size-3.5" aria-hidden /> Reopen
                  </>
                ) : (
                  <>
                    <CheckCheck className="size-3.5" aria-hidden /> Resolve
                  </>
                )}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
