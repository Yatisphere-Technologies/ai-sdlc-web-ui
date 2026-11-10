import { cn } from "../lib/cn";

/** Loading placeholder: neutral blocks that light up in turn (siblings stagger). Use `bg-working` for agent progress. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("bg-skeleton rounded-md", className)} />;
}
