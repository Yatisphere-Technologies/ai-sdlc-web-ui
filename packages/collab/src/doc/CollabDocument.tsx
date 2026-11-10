import {
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@throughline/ui";
import { ChevronDown, MessageSquarePlus, Sparkles } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import { reveal } from "../layout/reveal";
import type {
  Activity,
  AgentAsk,
  DocBlock,
  DocSuggestion,
  DocThread,
  NewComment,
  Participant,
} from "../types";
import { CommentBox, ThreadCard } from "./Comments";
import { SuggestionCard } from "./SuggestionCard";

const QUICK_ASKS = [
  { label: "Make it concise", prompt: "Make this concise" },
  { label: "Make it measurable", prompt: "Make this measurable" },
  { label: "More formal", prompt: "Make this more formal" },
  { label: "Fix grammar", prompt: "Fix the grammar" },
];

type Selection = { blockId: string; quote: string; x: number; y: number };

/** Text the user selected inside a block: page text or the selected part of a text field. */
function readSelection(root: HTMLElement): Selection | null {
  const active = document.activeElement;
  if (
    (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) &&
    root.contains(active) &&
    active.selectionStart !== null &&
    active.selectionEnd !== null &&
    active.selectionEnd - active.selectionStart > 2
  ) {
    const block = active.closest<HTMLElement>("[data-block-id]");
    if (!block?.dataset.blockId) return null;
    const r = active.getBoundingClientRect();
    return {
      blockId: block.dataset.blockId,
      quote: active.value.slice(active.selectionStart, active.selectionEnd).trim(),
      x: r.left + Math.min(r.width / 2, 200),
      y: r.top,
    };
  }
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const el = node instanceof HTMLElement ? node : node.parentElement;
  if (!el || !root.contains(el)) return null;
  const block = el.closest<HTMLElement>("[data-block-id]");
  const quote = sel.toString().trim();
  if (!block?.dataset.blockId || quote.length < 3) return null;
  const r = range.getBoundingClientRect();
  return { blockId: block.dataset.blockId, quote: quote.slice(0, 2000), x: r.left + r.width / 2, y: r.top };
}

function SelectionToolbar({
  sel,
  agentName,
  canAsk,
  canComment,
  onAsk,
  onComment,
  onClose,
}: {
  sel: Selection;
  agentName: string;
  canAsk: boolean;
  canComment: boolean;
  onAsk: (prompt: string) => void;
  onComment: () => void;
  onClose: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [prompt, setPrompt] = useState("");
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div
      role="toolbar"
      aria-label="Selected text"
      data-selection-toolbar
      className="border-line-strong bg-surface shadow-raise animate-pop fixed z-40 flex -translate-x-1/2 -translate-y-full flex-col gap-2 rounded-lg border p-1.5"
      // Positioned at the selection; the coordinates are layout, not design values.
      style={{ left: Math.max(180, Math.min(sel.x, window.innerWidth - 180)), top: Math.max(8, sel.y - 8) }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      {asking ? (
        <form
          className="flex w-80 flex-col gap-2 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (prompt.trim()) onAsk(prompt.trim());
          }}
        >
          <input
            // biome-ignore lint/a11y/noAutofocus: the input opens on request
            autoFocus
            aria-label={`Ask ${agentName} about the selection`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Ask ${agentName} to change this…`}
            className="border-line bg-surface-sunken text-body-sm focus:border-agent rounded-md border px-2.5 py-1.5 outline-none"
          />
          <div className="flex flex-wrap gap-1">
            {QUICK_ASKS.map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => onAsk(q.prompt)}
                className="border-line text-caption text-subtle hover:border-agent-line hover:text-agent-fg cursor-pointer rounded-full border px-2.5 py-0.5"
              >
                {q.label}
              </button>
            ))}
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-0.5">
          {canAsk ? (
            <button
              type="button"
              onMouseDown={keep}
              onClick={() => setAsking(true)}
              className="text-caption text-agent-fg hover:bg-agent-wash flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold"
            >
              <Sparkles className="size-3.5" aria-hidden /> Ask {agentName}
            </button>
          ) : null}
          {canComment ? (
            <button
              type="button"
              onMouseDown={keep}
              onClick={onComment}
              className="text-caption text-foreground hover:bg-surface-raised flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden /> Comment
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BlockView({
  block,
  suggestions,
  threads,
  people,
  agent,
  activity,
  readOnly,
  canComment,
  busy,
  composing,
  onCompose,
  onDecide,
  onComment,
  onReply,
  onResolve,
  onAsk,
  renderCite,
}: {
  block: DocBlock;
  suggestions: DocSuggestion[];
  threads: DocThread[];
  people: Map<string, Participant>;
  agent: Participant | undefined;
  activity: Activity | null;
  readOnly: boolean;
  canComment: boolean;
  busy: boolean;
  composing: { quote: string | null } | null;
  onCompose: (v: { quote: string | null } | null) => void;
  onDecide: (id: string, d: "accept" | "reject") => void;
  onComment?: (c: NewComment) => void;
  onReply?: (threadId: string, text: string, askAgent: boolean) => void;
  onResolve?: (threadId: string, resolved: boolean) => void;
  onAsk?: (a: AgentAsk) => void;
  renderCite?: (id: string) => ReactNode;
}) {
  const [showResolved, setShowResolved] = useState(false);
  const [asking, setAsking] = useState(false);
  const [prompt, setPrompt] = useState("");
  const open = threads.filter((t) => !t.resolved);
  const resolved = threads.filter((t) => t.resolved);
  const working = activity?.blockId === block.id;
  const agentName = agent?.name ?? "agent";

  return (
    <section
      id={`block-${block.id}`}
      data-block-id={block.id}
      aria-label={block.label}
      data-active={block.highlighted || undefined}
      className={cn(
        "group/block -mx-3 flex scroll-mt-6 flex-col gap-3 border-l-2 pl-3 transition-colors",
        working ? "border-agent" : block.highlighted ? "border-agent-line" : "border-transparent",
      )}
    >
      <div className="flex items-start gap-3">
        {block.number !== undefined ? (
          <span className="text-micro text-faint mt-2 w-5 shrink-0 font-mono">{block.number}</span>
        ) : null}
        <div className="min-w-0 flex-1">{block.title}</div>
        <div
          className={cn(
            "flex shrink-0 items-center gap-0.5 transition-opacity",
            "lg:opacity-0 lg:group-focus-within/block:opacity-100 lg:group-hover/block:opacity-100",
            (open.length > 0 || composing) && "lg:opacity-100",
          )}
        >
          {onAsk && !readOnly ? (
            <Menu>
              <MenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Ask ${agentName} about ${block.label}`}
                  className="text-caption text-agent-fg hover:bg-agent-wash flex cursor-pointer items-center gap-1 rounded-md px-2 py-1"
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">Ask</span>
                  <ChevronDown className="size-3" aria-hidden />
                </button>
              </MenuTrigger>
              <MenuContent align="end">
                <MenuLabel>{block.label}</MenuLabel>
                {(block.actions ?? []).map((a) => (
                  <MenuItem
                    key={a.id}
                    onSelect={() => onAsk({ blockId: block.id, quote: null, prompt: a.prompt })}
                  >
                    {a.label}
                  </MenuItem>
                ))}
                {block.actions?.length ? <MenuSeparator /> : null}
                <MenuItem onSelect={() => setAsking(true)}>Ask something else…</MenuItem>
              </MenuContent>
            </Menu>
          ) : null}
          {canComment && onComment ? (
            <button
              type="button"
              aria-label={`Comment on ${block.label}${open.length ? ` (${open.length} open)` : ""}`}
              onClick={() => onCompose(composing ? null : { quote: null })}
              className="text-caption text-muted hover:bg-surface-raised hover:text-foreground flex cursor-pointer items-center gap-1 rounded-md px-2 py-1"
            >
              <MessageSquarePlus className="size-3.5" aria-hidden />
              {open.length ? <span className="text-gate-fg font-mono">{open.length}</span> : null}
            </button>
          ) : null}
        </div>
      </div>
      {block.issues}
      {working ? (
        <div
          className="border-agent-line bg-agent-wash flex items-center gap-2.5 rounded-lg border px-3 py-2"
          aria-live="polite"
        >
          <Avatar p={agent} size="sm" />
          <span className="text-caption text-agent-fg">{activity?.label ?? "Working…"}</span>
          <span className="bg-working ml-auto h-1.5 w-24 rounded-full" aria-hidden />
        </div>
      ) : null}
      {asking && onAsk ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!prompt.trim()) return;
            onAsk({ blockId: block.id, quote: null, prompt: prompt.trim() });
            setPrompt("");
            setAsking(false);
          }}
        >
          <Sparkles className="text-agent size-4 shrink-0" aria-hidden />
          <input
            // biome-ignore lint/a11y/noAutofocus: opened on request from the block menu
            autoFocus
            aria-label={`Ask ${agentName} about ${block.label}`}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
            placeholder={`Ask ${agentName} about ${block.label.toLowerCase()}…`}
            className="border-line bg-surface-sunken text-body-sm focus:border-agent flex-1 rounded-md border px-3 py-1.5 outline-none"
          />
          <Button size="sm" type="submit" disabled={!prompt.trim()}>
            Ask
          </Button>
        </form>
      ) : null}
      {suggestions.length ? (
        <div className="flex flex-col gap-2">
          {suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              author={people.get(s.authorId)}
              canDecide={!readOnly}
              busy={busy}
              onDecide={onDecide}
              renderCite={renderCite}
            />
          ))}
        </div>
      ) : null}
      {composing && onComment ? (
        <div className="border-gate-line bg-surface-raised rounded-lg border px-3 py-2.5">
          <CommentBox
            autoFocus
            quote={composing.quote}
            busy={busy}
            agentName={agentName}
            onCancel={() => onCompose(null)}
            onSubmit={(text, askAgent) => {
              onComment({ blockId: block.id, quote: composing.quote, text, askAgent });
              onCompose(null);
            }}
          />
        </div>
      ) : null}
      {open.length ? (
        <div className="flex flex-col gap-2">
          {open.map((t) => (
            <ThreadCard
              key={t.id}
              t={t}
              people={people}
              canComment={canComment}
              busy={busy}
              agentName={agentName}
              onReply={onReply}
              onResolve={onResolve}
            />
          ))}
        </div>
      ) : null}
      {resolved.length ? (
        <button
          type="button"
          aria-expanded={showResolved}
          onClick={() => setShowResolved((v) => !v)}
          className="text-caption text-faint hover:text-muted w-fit cursor-pointer"
        >
          {showResolved ? "Hide" : "Show"} {resolved.length} resolved comment{resolved.length > 1 ? "s" : ""}
        </button>
      ) : null}
      {showResolved
        ? resolved.map((t) => (
            <ThreadCard
              key={t.id}
              t={t}
              people={people}
              canComment={canComment}
              busy={busy}
              onResolve={onResolve}
            />
          ))
        : null}
      <div>{block.content}</div>
    </section>
  );
}

/**
 * A document people and agents work on together. Every block can be commented on and handed to the
 * agent; the agent's changes appear in place as tracked changes to accept or reject; selecting text
 * offers "Ask agent" and "Comment"; and the block the agent is working on is marked while it works.
 * The host owns the content (blocks render their own editors) and all persistence.
 */
export function CollabDocument({
  header,
  blocks,
  participants,
  suggestions = [],
  threads = [],
  activity = null,
  readOnly = false,
  canComment = false,
  busy = false,
  onDecide,
  onComment,
  onReply,
  onResolve,
  onAsk,
  renderCite,
  className,
}: {
  header?: ReactNode;
  blocks: DocBlock[];
  participants: Participant[];
  suggestions?: DocSuggestion[];
  threads?: DocThread[];
  activity?: Activity | null;
  /** Content can't be edited and suggestions can't be decided (comments may still be allowed). */
  readOnly?: boolean;
  canComment?: boolean;
  busy?: boolean;
  onDecide: (id: string, d: "accept" | "reject") => void;
  onComment?: (c: NewComment) => void;
  onReply?: (threadId: string, text: string, askAgent: boolean) => void;
  onResolve?: (threadId: string, resolved: boolean) => void;
  onAsk?: (a: AgentAsk) => void;
  renderCite?: (id: string) => ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const people = useMemo(() => new Map(participants.map((p) => [p.id, p])), [participants]);
  const agent = participants.find((p) => p.kind === "agent");
  const [sel, setSel] = useState<Selection | null>(null);
  const [composing, setComposing] = useState<{ blockId: string; quote: string | null } | null>(null);

  const check = useCallback(() => {
    if (!root.current) return;
    // Let the browser finish updating the selection first.
    requestAnimationFrame(() => setSel(root.current ? readSelection(root.current) : null));
  }, []);
  // Follow the selection when the page scrolls or resizes (it disappears if the selection does).
  useEffect(() => {
    const follow = () => setSel((cur) => (cur && root.current ? (readSelection(root.current) ?? cur) : cur));
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, []);

  const byBlock = <T extends { blockId: string }>(xs: T[], id: string) => xs.filter((x) => x.blockId === id);
  const known = new Set(blocks.map((b) => b.id));
  const orphans = suggestions.filter((s) => !known.has(s.blockId));

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: listens for text selection to offer actions; every action is also reachable from each block's toolbar
    <div
      ref={root}
      className={cn("relative flex flex-col gap-10", className)}
      onMouseUp={(e) => {
        if (!(e.target as HTMLElement).closest("[data-selection-toolbar]")) check();
      }}
      onKeyUp={(e) => {
        if (e.shiftKey && !(e.target as HTMLElement).closest("[data-selection-toolbar]")) check();
      }}
    >
      {header}
      {orphans.length ? (
        <div className="flex flex-col gap-2">
          {orphans.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              author={people.get(s.authorId)}
              canDecide={!readOnly}
              busy={busy}
              onDecide={onDecide}
              renderCite={renderCite}
            />
          ))}
        </div>
      ) : null}
      {blocks.map((b) => (
        <BlockView
          key={b.id}
          block={b}
          suggestions={byBlock(suggestions, b.id)}
          threads={byBlock(threads, b.id)}
          people={people}
          agent={agent}
          activity={activity}
          readOnly={readOnly}
          canComment={canComment}
          busy={busy}
          composing={composing?.blockId === b.id ? { quote: composing.quote } : null}
          onCompose={(v) => setComposing(v ? { blockId: b.id, quote: v.quote } : null)}
          onDecide={onDecide}
          onComment={onComment}
          onReply={onReply}
          onResolve={onResolve}
          onAsk={onAsk}
          renderCite={renderCite}
        />
      ))}
      {sel && (onAsk || (canComment && onComment)) ? (
        <SelectionToolbar
          sel={sel}
          agentName={agent?.name ?? "agent"}
          canAsk={Boolean(onAsk) && !readOnly}
          canComment={canComment && Boolean(onComment)}
          onClose={() => setSel(null)}
          onAsk={(prompt) => {
            onAsk?.({ blockId: sel.blockId, quote: sel.quote, prompt });
            setSel(null);
            window.getSelection()?.removeAllRanges();
          }}
          onComment={() => {
            setComposing({ blockId: sel.blockId, quote: sel.quote });
            setSel(null);
            reveal(document.getElementById(`block-${sel.blockId}`));
          }}
        />
      ) : null}
    </div>
  );
}
