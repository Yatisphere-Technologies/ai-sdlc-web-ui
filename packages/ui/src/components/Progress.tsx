import { cn } from "../lib/cn";
import { type Tone, toneFill } from "../lib/tone";

export function clampPercent(value: number) {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

export type ProgressProps = {
  value: number;
  tone?: Tone;
  /** Shimmer while an agent is working on it */
  working?: boolean;
  size?: "sm" | "md" | "lg";
  label: string;
  className?: string;
};

export function Progress({
  value,
  tone = "agent",
  working = false,
  size = "sm",
  label,
  className,
}: ProgressProps) {
  const pct = clampPercent(value);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn(
        "bg-line w-full overflow-hidden rounded-full",
        size === "sm" && "h-1",
        size === "md" && "h-1.5",
        size === "lg" && "h-2.5",
        className,
      )}
    >
      <div
        className={cn(
          "ease-out-soft h-full rounded-full transition-[width] duration-500",
          working ? "bg-working" : toneFill[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
