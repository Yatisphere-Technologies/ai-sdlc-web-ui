import { X } from "lucide-react";
import { AlertDialog, Dialog as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "./Button";

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;
export const DialogClose = Primitive.Close;

const WIDTH = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" } as const;
const OVERLAY = "bg-scrim fixed inset-0 z-50 backdrop-blur-sm data-[state=open]:animate-rise";
const PANEL =
  "border-line-strong bg-surface shadow-lift fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border outline-none data-[state=open]:animate-rise";

/**
 * A modal panel with a title, optional description, scrolling body and a footer for actions.
 * Focus is trapped while open and returns to the trigger on close; Escape closes it.
 */
export function DialogContent({
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  hideClose,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions, right-aligned. */
  footer?: ReactNode;
  size?: keyof typeof WIDTH;
  className?: string;
  hideClose?: boolean;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className={OVERLAY} />
      <Primitive.Content className={cn(PANEL, WIDTH[size], className)}>
        <header className="border-line flex items-start gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Primitive.Title className="font-display text-heading-sm text-strong">{title}</Primitive.Title>
            {description ? (
              <Primitive.Description className="text-body-sm text-muted">{description}</Primitive.Description>
            ) : (
              <Primitive.Description className="sr-only">{title}</Primitive.Description>
            )}
          </div>
          {hideClose ? null : (
            <Primitive.Close
              aria-label="Close"
              className="text-muted hover:bg-surface-raised hover:text-foreground grid size-8 shrink-0 cursor-pointer place-items-center rounded-md"
            >
              <X className="size-4" />
            </Primitive.Close>
          )}
        </header>
        {children ? <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : null}
        {footer ? (
          <footer className="border-line flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </Primitive.Content>
    </Primitive.Portal>
  );
}

/**
 * Asks before something consequential or hard to undo (pushing to Jira, discarding work).
 * Controlled: the caller owns `open`. The confirm button can be busy while the action runs.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Extra detail between the description and the buttons. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "gate" | "danger";
  busy?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={OVERLAY} />
        <AlertDialog.Content className={cn(PANEL, WIDTH.sm)}>
          <div className="flex flex-col gap-2 px-5 pt-5 pb-4">
            <AlertDialog.Title className="font-display text-heading-sm text-strong">
              {title}
            </AlertDialog.Title>
            {description ? (
              <AlertDialog.Description className="text-body-sm text-muted">
                {description}
              </AlertDialog.Description>
            ) : (
              <AlertDialog.Description className="sr-only">{title}</AlertDialog.Description>
            )}
            {children}
          </div>
          <footer className="border-line flex flex-wrap items-center justify-end gap-2 border-t px-5 py-3">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" size="sm">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={tone}
              size="sm"
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              {confirmLabel}
            </Button>
          </footer>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
