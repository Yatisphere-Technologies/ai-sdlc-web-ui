import { cn } from "../lib/cn";
import { type Tone, toneFill, toneText } from "../lib/tone";

export type StatusDotProps = {
  tone?: Tone;
  /** Pulse to show something is live right now */
  live?: boolean;
  size?: "sm" | "md";
  className?: string;
  label?: string;
};

export function StatusDot({ tone = "agent", live = false, size = "sm", className, label }: StatusDotProps) {
  const dot = (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rounded-full",
        size === "sm" ? "size-1.5" : "size-2.5",
        toneFill[tone],
        live && ["live-ping", toneText[tone]],
        className,
      )}
    />
  );
  if (!label) return dot;
  return (
    <span role="img" aria-label={label} className="inline-flex">
      {dot}
    </span>
  );
}
