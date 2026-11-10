import { cn } from "../lib/cn";

/** Loading placeholder that shimmers like agent work. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bg-working rounded-md opacity-60", className)} />;
}
