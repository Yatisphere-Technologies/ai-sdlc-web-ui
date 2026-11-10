import { cn, Tooltip } from "@throughline/ui";
import { Mic, MicOff, Square } from "lucide-react";
import { useMicLevel } from "./hooks";
import { Waveform } from "./Waveform";

/**
 * Dictation toggle for a message box. Shows a live waveform while listening and explains itself
 * when voice is unavailable.
 */
export function MicButton({
  listening,
  blocked,
  onToggle,
  disabled,
  size = "md",
}: {
  listening: boolean;
  /** Why the mic can't be used; the button stays visible but explains. */
  blocked: string | null;
  onToggle: () => void;
  disabled?: boolean;
  size?: "md" | "lg";
}) {
  const level = useMicLevel(listening);
  const box = size === "lg" ? "h-10 min-w-10" : "h-8 min-w-8";
  if (blocked)
    return (
      <Tooltip content={blocked}>
        <span className={cn("text-ghost grid place-items-center rounded-full", box)}>
          <MicOff className="size-4" aria-label={`Voice input unavailable: ${blocked}`} />
        </span>
      </Tooltip>
    );
  return (
    <Tooltip content={listening ? "Stop dictation" : "Dictate"} shortcut={listening ? undefined : "⌥ D"}>
      <button
        type="button"
        aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
        aria-pressed={listening}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "grid cursor-pointer place-items-center rounded-full px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          box,
          listening
            ? "bg-risk-soft text-risk-fg flex gap-1.5"
            : "text-muted hover:bg-surface-raised hover:text-foreground",
        )}
      >
        {listening ? (
          <>
            <Square className="size-3 fill-current" aria-hidden />
            <Waveform level={level} />
          </>
        ) : (
          <Mic className="size-4" aria-hidden />
        )}
      </button>
    </Tooltip>
  );
}
