import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** A pill-shaped toggle for filters and quick choices. */
export function Chip({
  selected = false,
  tone = "agent",
  className,
  ...props
}: ComponentProps<"button"> & { selected?: boolean; tone?: "agent" | "gate" }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "press text-body-sm inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-xs border px-3.5",
        !selected && "border-line-strong bg-surface text-subtle hover:border-agent",
        selected && tone === "agent" && "border-agent bg-agent-wash text-agent-fg",
        selected && tone === "gate" && "border-gate bg-gate-soft text-gate-fg",
        className,
      )}
      {...props}
    />
  );
}
