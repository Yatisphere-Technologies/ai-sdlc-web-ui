import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva("inline-flex items-center gap-1.5 rounded-xs px-2.5 py-0.5 whitespace-nowrap", {
  variants: {
    tone: {
      neutral: "border-line-strong text-muted border",
      agent: "bg-agent-soft text-agent-fg",
      human: "bg-human-soft text-human-fg",
      gate: "bg-gate-soft text-gate-fg",
      ok: "bg-ok-soft text-ok",
      risk: "bg-risk-soft text-risk-fg",
      ion: "bg-ion-soft text-ion-fg",
    },
    mono: {
      true: "text-micro tracking-label font-mono uppercase",
      false: "text-caption font-medium",
    },
  },
  defaultVariants: { tone: "neutral", mono: false },
});

export type BadgeProps = ComponentProps<"span"> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, mono, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, mono }), className)} {...props} />;
}
