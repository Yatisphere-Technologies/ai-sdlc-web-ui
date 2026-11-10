import { Tooltip as Primitive } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn";
import { Kbd } from "./Typography";

/** Mount once near the root so tooltips share one delay. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Primitive.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </Primitive.Provider>
  );
}

/**
 * A short label on hover or keyboard focus. Wrap the trigger (a button or link); give icon-only
 * buttons an aria-label as well, because tooltips are not announced on touch devices.
 */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  align = "center",
  children,
  className,
}: {
  content: ReactNode;
  /** Keyboard shortcut shown after the label, e.g. "⌘K". */
  shortcut?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: ReactElement;
  className?: string;
}) {
  if (!content) return children;
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "border-line-strong bg-surface-raised text-caption text-foreground shadow-raise z-50 flex max-w-xs items-center gap-2 rounded-md border px-2.5 py-1.5",
            "data-[state=delayed-open]:animate-rise",
            className,
          )}
        >
          <span>{content}</span>
          {shortcut ? <Kbd>{shortcut}</Kbd> : null}
          <Primitive.Arrow className="fill-surface-raised" width={10} height={5} />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
