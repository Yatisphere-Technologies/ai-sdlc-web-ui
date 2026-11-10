import { Popover as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverClose = Primitive.Close;

/** A small floating panel anchored to its trigger (filters, quick forms, details). */
export function PopoverContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={8}
        align="start"
        collisionPadding={8}
        className={cn(
          "border-line-strong bg-surface shadow-lift animate-rise z-50 w-72 rounded-lg border p-3 outline-none",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}
