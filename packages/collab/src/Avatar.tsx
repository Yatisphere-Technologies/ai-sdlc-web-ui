import { cn } from "@throughline/ui";
import { Sparkles } from "lucide-react";
import type { Activity, Participant } from "./types";

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

const TONE = {
  agent: "bg-agent-soft text-agent-fg",
  you: "bg-human-soft text-human-fg",
  other: "bg-ion-soft text-ion-fg",
} as const;

export function Avatar({
  p,
  size = "md",
  className,
}: {
  p: Participant | undefined;
  size?: "sm" | "md";
  className?: string;
}) {
  const tone = !p ? TONE.other : p.kind === "agent" ? TONE.agent : p.you ? TONE.you : TONE.other;
  return (
    <span
      title={p ? `${p.name}${p.role ? ` · ${p.role}` : ""}` : "Unknown"}
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-mono",
        size === "sm" ? "text-nano size-6" : "text-micro size-7",
        tone,
        className,
      )}
    >
      {p?.kind === "agent" ? (
        <Sparkles className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden />
      ) : (
        initials(p?.name ?? "?")
      )}
      <span className="sr-only">{p?.name ?? "Unknown"}</span>
    </span>
  );
}

/** Who's in the document, and what the agent is doing. */
export function PresenceBar({
  participants,
  activity,
  max = 5,
}: {
  participants: Participant[];
  activity?: Activity | null;
  max?: number;
}) {
  const shown = participants.slice(0, max);
  const more = participants.length - shown.length;
  const busy = activity ? participants.find((p) => p.id === activity.participantId) : undefined;
  return (
    <div className="flex items-center gap-2">
      <ul aria-label="People and agents in this document" className="flex -space-x-1.5">
        {shown.map((p) => (
          <li key={p.id} className="relative">
            <Avatar p={p} size="sm" className="ring-surface-nav ring-2" />
            {p.online ? (
              <span
                className={cn(
                  "ring-surface-nav absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2",
                  p.kind === "agent" && activity?.participantId === p.id ? "bg-agent animate-pulse" : "bg-ok",
                )}
              >
                <span className="sr-only">online</span>
              </span>
            ) : null}
          </li>
        ))}
        {more > 0 ? (
          <li className="bg-surface-raised text-nano text-muted ring-surface-nav grid size-6 place-items-center rounded-full font-mono ring-2">
            +{more}
          </li>
        ) : null}
      </ul>
      {busy && activity ? (
        <span className="text-caption text-agent-fg hidden items-center gap-1.5 xl:flex" aria-live="polite">
          {busy.name} · {activity.label}
        </span>
      ) : null}
    </div>
  );
}
