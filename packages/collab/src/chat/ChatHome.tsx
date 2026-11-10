import { cn } from "@throughline/ui";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export type Starter = { label: string; prompt: string; icon?: ReactNode };

/**
 * The opening screen of a conversation, like a modern assistant: a greeting, the message box in the
 * middle of the page, and a few starters. Once there are messages the host switches to ChatThread.
 */
export function ChatHome({
  title,
  subtitle,
  composer,
  starters = [],
  onStarter,
  kind,
  className,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  /** The Composer (or anything) to show under the greeting. */
  composer: ReactNode;
  starters?: Starter[];
  onStarter?: (s: Starter) => void;
  /** Small label above the title, e.g. the kind of document being written. */
  kind?: ReactNode;
  className?: string;
  /** Smaller greeting for side panels. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4",
        compact ? "justify-end py-6" : "justify-center py-10",
        className,
      )}
    >
      <div className="animate-rise flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {kind ? <span className="eyebrow text-agent-fg">{kind}</span> : null}
          <span className="bg-agent-soft text-agent-fg grid size-11 place-items-center rounded-full">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <h1 className={cn("font-display text-strong", compact ? "text-heading-lg" : "text-display-md")}>
            {title}
          </h1>
          {subtitle ? <p className="text-body text-muted max-w-xl">{subtitle}</p> : null}
        </div>
        {composer}
        {starters.length && onStarter ? (
          <ul className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
            {starters.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => onStarter(s)}
                  className="border-line bg-surface hover:border-agent-line hover:bg-agent-wash flex h-full w-full cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors"
                >
                  {s.icon ? <span className="text-agent-fg mt-0.5 shrink-0">{s.icon}</span> : null}
                  <span className="flex flex-col gap-0.5">
                    <span className="text-body-sm text-strong font-semibold">{s.label}</span>
                    <span className="text-caption text-muted line-clamp-2">{s.prompt}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
