import { cn } from "@throughline/ui";

const BARS = [0.45, 0.75, 1, 0.7, 0.5];

/**
 * Small live level meter. With a measured `level` the bars follow the voice; without one (mic not
 * readable) they breathe gently; with reduced motion they stay still.
 */
export function Waveform({ level, className }: { level: number | null; className?: string }) {
  return (
    <span aria-hidden className={cn("flex h-4 items-center gap-0.5", className)}>
      {BARS.map((b, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed set of bars
          key={i}
          className={cn(
            "w-0.5 rounded-full bg-current transition-transform duration-75 motion-reduce:transition-none",
            level === null && "animate-pulse",
          )}
          style={{
            height: "100%",
            transform: `scaleY(${level === null ? b * 0.6 : Math.max(0.15, Math.min(1, level * b * 1.6))})`,
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </span>
  );
}
