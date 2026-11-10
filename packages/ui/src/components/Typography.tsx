import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

/** Small mono label above a heading: section, context, live status. */
export function Eyebrow({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("eyebrow text-muted", className)} {...props} />;
}

export function PageHeader({
  eyebrow,
  title,
  accent,
  actions,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Second half of the title, shown in the agent colour */
  accent?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("animate-rise flex flex-wrap items-end justify-between gap-5", className)}>
      <div className="flex min-w-0 flex-col gap-2.5">
        {eyebrow ? <div className="flex items-center gap-2.5">{eyebrow}</div> : null}
        <h1 className="font-display text-display-md text-strong">
          {title} {accent ? <span className="text-agent">{accent}</span> : null}
        </h1>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </header>
  );
}

export function Metric({ value, className }: { value: ReactNode; className?: string }) {
  return <span className={cn("font-display text-metric-lg text-foreground", className)}>{value}</span>;
}

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn("border-line-strong text-nano text-muted rounded-xs border px-1.5 font-mono", className)}
      {...props}
    />
  );
}
