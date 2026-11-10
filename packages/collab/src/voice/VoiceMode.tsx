import { Button, cn } from "@throughline/ui";
import { Hand, Mic, Pause, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useMicLevel, useVoiceConversation } from "./hooks";
import { useVoiceSettings } from "./VoiceProvider";

const STATUS = {
  idle: "Tap the circle and start talking",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking · tap to interrupt",
  error: "Something went wrong",
} as const;

/**
 * Full-screen hands-free conversation, like a voice assistant: listen, answer out loud, listen
 * again. `respond` gets what was said and resolves to the reply text (Markdown is fine). Works on
 * any screen size; Escape or the close button ends it, Space interrupts or resumes.
 */
export function VoiceMode({
  open,
  onClose,
  respond,
  title = "Voice",
  agentName = "Assistant",
}: {
  open: boolean;
  onClose: () => void;
  respond: (text: string) => Promise<string | null>;
  title?: string;
  agentName?: string;
}) {
  if (!open) return null;
  // Portalled so it covers the whole screen even when opened from a transformed panel.
  const ui = <VoiceModeOpen onClose={onClose} respond={respond} title={title} agentName={agentName} />;
  return typeof document === "undefined" ? ui : createPortal(ui, document.body);
}

function VoiceModeOpen({
  onClose,
  respond,
  title,
  agentName,
}: {
  onClose: () => void;
  respond: (text: string) => Promise<string | null>;
  title: string;
  agentName: string;
}) {
  const { engine } = useVoiceSettings();
  const v = useVoiceConversation(respond);
  const { turn, interim, heard, reply, error } = v.state;
  const level = useMicLevel(turn === "listening");
  const scale = turn === "listening" ? 1 + (level ?? 0.15) * 0.35 : turn === "speaking" ? 1.06 : 1;

  // Start listening as soon as voice mode opens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on open
  useEffect(() => {
    if (!v.blocked) v.start();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " " && (e.target as HTMLElement).tagName !== "BUTTON") {
        e.preventDefault();
        if (turn === "speaking") v.interrupt();
        else if (turn === "listening") v.finish();
        else v.start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn, onClose, v]);

  const onOrb = () => {
    if (turn === "speaking") v.interrupt();
    else if (turn === "listening") v.finish();
    else if (turn !== "thinking") v.start();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} conversation`}
      className="bg-background/95 fixed inset-0 z-50 flex flex-col backdrop-blur-md"
    >
      <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <span className="flex flex-col">
          <span className="text-body text-strong font-semibold">{title}</span>
          <span className="text-caption text-muted">{engine.where}</span>
        </span>
        <Button variant="ghost" size="sm" aria-label="End voice conversation" onClick={onClose}>
          <X className="size-5" aria-hidden />
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <button
          type="button"
          onClick={onOrb}
          disabled={turn === "thinking" || Boolean(v.blocked)}
          aria-label={
            turn === "speaking"
              ? "Interrupt"
              : turn === "listening"
                ? "Done speaking"
                : turn === "thinking"
                  ? "Thinking"
                  : "Start talking"
          }
          className={cn(
            "relative grid size-40 cursor-pointer place-items-center rounded-full transition-transform duration-150 motion-reduce:transition-none sm:size-48",
            turn === "listening" && "bg-agent-soft text-agent",
            turn === "thinking" && "bg-ion-soft text-ion animate-pulse",
            turn === "speaking" && "bg-agent text-agent-ink",
            (turn === "idle" || turn === "error") && "bg-surface-raised text-muted border-line-strong border",
          )}
          style={{ transform: `scale(${scale})` }}
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-0 rounded-full border-2",
              turn === "listening"
                ? "border-agent animate-ping opacity-30 motion-reduce:animate-none"
                : "border-transparent",
            )}
          />
          {turn === "speaking" ? (
            <Hand className="size-10" aria-hidden />
          ) : (
            <Mic className="size-10" aria-hidden />
          )}
        </button>
        <div className="flex w-full max-w-xl flex-col gap-3" aria-live="polite">
          <span className={cn("text-body font-semibold", turn === "error" ? "text-risk-fg" : "text-subtle")}>
            {turn === "error" ? error : (v.blocked ?? STATUS[turn])}
          </span>
          {interim || (turn === "listening" && heard === "" && !interim) ? (
            <p className="text-heading-sm text-foreground min-h-8">{interim}</p>
          ) : heard ? (
            <p className="text-body text-muted">
              <span className="text-faint">You: </span>
              {heard}
            </p>
          ) : null}
          {reply && (turn === "speaking" || turn === "idle" || turn === "listening") ? (
            <p className="text-body text-foreground line-clamp-6">
              <span className="text-agent-fg">{agentName}: </span>
              {reply}
            </p>
          ) : null}
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-center gap-3 px-4 pt-2 pb-6">
        {turn === "listening" || turn === "speaking" ? (
          <Button variant="secondary" onClick={v.pause}>
            <Pause className="size-4" aria-hidden /> Pause
          </Button>
        ) : (
          <Button variant="secondary" disabled={turn === "thinking" || Boolean(v.blocked)} onClick={v.start}>
            <Mic className="size-4" aria-hidden /> {turn === "error" ? "Try again" : "Talk"}
          </Button>
        )}
        <Button variant="danger" onClick={onClose}>
          <X className="size-4" aria-hidden /> End
        </Button>
      </footer>
    </div>
  );
}
