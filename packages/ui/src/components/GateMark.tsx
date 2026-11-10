import { cn } from "../lib/cn";

export type GateState = "open" | "approved" | "idle";

/** The amber diamond: a person decides here. Turns green once approved. */
export function GateMark({
  state = "open",
  size = "md",
  className,
}: {
  state?: GateState;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block shrink-0 rotate-45 rounded-xs border-2",
        size === "sm" && "size-2.5",
        size === "md" && "size-3",
        size === "lg" && "size-4",
        state === "open" && "border-gate bg-gate-soft",
        state === "approved" && "border-ok bg-ok-soft",
        state === "idle" && "border-line-strong",
        className,
      )}
    />
  );
}
