import { cn } from "@throughline/ui";

/** Deterministic monogram for a workspace. */
export function TenantAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "border-agent-line bg-agent-soft text-agent flex shrink-0 items-center justify-center rounded-sm border font-mono",
        size === "md" ? "text-micro size-8" : "text-body size-12",
      )}
    >
      {letters}
    </span>
  );
}
