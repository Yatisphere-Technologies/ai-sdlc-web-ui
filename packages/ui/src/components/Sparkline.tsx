import { cn } from "../lib/cn";
import { type Tone, toneText } from "../lib/tone";

/** Turns a series into SVG polyline points inside a width × height box (higher value = higher line). */
export function toPoints(
  values: readonly number[],
  width = 200,
  height = 40,
  pad = 4,
  domain?: readonly [number, number],
) {
  if (values.length === 0) return "";
  const min = domain ? domain[0] : Math.min(...values);
  const max = domain ? domain[1] : Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  return values
    .map((v, i) => {
      const x = Math.round(i * step * 10) / 10;
      const y = Math.round((height - pad - ((v - min) / span) * (height - pad * 2)) * 10) / 10;
      return `${x},${y}`;
    })
    .join(" ");
}

export function Sparkline({
  values,
  tone = "agent",
  domain,
  className,
}: {
  values: readonly number[];
  tone?: Tone;
  /** Shared [min, max] so several sparklines drawn on top of each other use the same scale */
  domain?: readonly [number, number];
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("h-10 w-full", toneText[tone], className)}
    >
      <polyline
        className="draw-in"
        points={toPoints(values, 200, 40, 4, domain)}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      />
    </svg>
  );
}
