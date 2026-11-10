import { Button, cn } from "@throughline/ui";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar } from "../Avatar";
import type { DocSuggestion, Participant } from "../types";
import { diffWords } from "./diff";

/** A proposed rewrite shown as a tracked change: removed words struck through, added words highlighted. */
export function TrackedChange({ before, after }: { before: string; after: string }) {
  const parts = diffWords(before, after);
  return (
    <p className="text-body-sm text-foreground whitespace-pre-line">
      {parts.map((p, i) =>
        p.type === "same" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff parts are positional
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff parts are positional
          <del key={i} className="bg-risk-soft text-risk-fg decoration-risk-fg rounded-xs">
            {p.text}
          </del>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: diff parts are positional
          <ins key={i} className="bg-ok-soft text-ok rounded-xs no-underline">
            {p.text}
          </ins>
        ),
      )}
    </p>
  );
}

export function SuggestionCard({
  s,
  author,
  canDecide,
  busy,
  onDecide,
  renderCite,
  compact = false,
}: {
  s: DocSuggestion;
  author: Participant | undefined;
  canDecide: boolean;
  busy?: boolean;
  onDecide: (id: string, d: "accept" | "reject") => void;
  renderCite?: (id: string) => ReactNode;
  compact?: boolean;
}) {
  const hasDiff = typeof s.before === "string" && typeof s.after === "string";
  return (
    <article
      id={`suggestion-${s.id}`}
      aria-label={`Suggestion: ${s.summary}`}
      className={cn(
        "border-agent-line bg-agent-wash flex scroll-mt-24 flex-col gap-2 rounded-lg border border-l-2",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <header className="flex items-start gap-2">
        <Avatar p={author} size="sm" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm text-strong font-semibold">{s.summary}</span>
          <span className="text-nano text-agent-fg font-mono tracking-wide uppercase">
            Suggested by {author?.name ?? "someone"}
            {s.rowId ? ` · ${s.rowId}` : ""}
          </span>
        </div>
      </header>
      {hasDiff ? (
        <TrackedChange before={s.before ?? ""} after={s.after ?? ""} />
      ) : s.detail ? (
        <div>{s.detail}</div>
      ) : null}
      {s.cites?.length ? (
        <span className="text-nano text-ion-fg flex flex-wrap items-center gap-1 font-mono">
          cites{" "}
          {s.cites.map((c) => (renderCite ? <span key={c}>{renderCite(c)}</span> : <span key={c}>{c}</span>))}
        </span>
      ) : null}
      {canDecide ? (
        <div className="flex gap-1.5">
          <Button size="sm" disabled={busy} onClick={() => onDecide(s.id, "accept")}>
            <Check className="size-3.5" aria-hidden /> Accept
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide(s.id, "reject")}>
            <X className="size-3.5" aria-hidden /> Reject
          </Button>
        </div>
      ) : null}
    </article>
  );
}
