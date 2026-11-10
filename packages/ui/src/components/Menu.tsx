import { DropdownMenu } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenu.Content> & { children: ReactNode }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={8}
        align="start"
        className={cn(
          "animate-rise border-line-strong bg-surface shadow-lift z-50 min-w-64 rounded-lg border p-1.5",
          className,
        )}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        "text-body text-foreground data-[highlighted]:bg-surface-raised flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 outline-none select-none",
        className,
      )}
      {...props}
    />
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("eyebrow text-muted px-3 pt-2 pb-1", className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="bg-line my-1 h-px" />;
}
