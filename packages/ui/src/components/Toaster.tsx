import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

/**
 * Toast notifications (sonner) styled with the design tokens, so they follow the light and dark
 * themes. Mount once at the root; call `toast.success("Saved")`, `toast.error(…)`,
 * `toast.promise(…)`, or `toast("Undone", { action: { label: "Redo", onClick } })` anywhere.
 */
export function Toaster({ theme }: { theme: "light" | "dark" }) {
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      visibleToasts={4}
      gap={8}
      offset={16}
      icons={{
        success: <CircleCheck className="text-ok size-4" />,
        error: <CircleAlert className="text-risk-fg size-4" />,
        warning: <TriangleAlert className="text-gate size-4" />,
        info: <Info className="text-ion-fg size-4" />,
        loading: <LoaderCircle className="text-agent size-4 animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group border-line-strong bg-surface-raised text-foreground shadow-lift flex w-full items-start gap-3 rounded-lg border px-4 py-3 font-sans",
          title: "text-body-sm text-strong font-semibold",
          description: "text-caption text-muted mt-0.5",
          icon: "mt-0.5",
          content: "flex min-w-0 flex-1 flex-col",
          actionButton:
            "bg-agent text-agent-ink text-caption ml-auto shrink-0 cursor-pointer rounded-md px-2.5 py-1 font-semibold",
          cancelButton:
            "text-muted hover:text-foreground text-caption shrink-0 cursor-pointer rounded-md px-2 py-1",
          closeButton: "border-line bg-surface text-muted hover:text-foreground border",
          success: "border-ok-line",
          error: "border-risk-line",
          warning: "border-gate-line",
        },
      }}
    />
  );
}
