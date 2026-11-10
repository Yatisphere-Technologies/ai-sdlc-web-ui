import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const cardVariants = cva("rounded-2xl border", {
  variants: {
    tone: {
      default: "border-line bg-surface",
      raised: "border-line bg-surface-raised",
      agent: "border-agent-line bg-agent-wash",
      gate: "border-gate-line bg-gate-wash",
      ok: "border-ok-line bg-ok-wash",
      risk: "border-risk-line bg-risk-soft",
      sunken: "border-line bg-surface-sunken",
    },
    padding: { none: "", sm: "p-4", md: "p-5", lg: "p-6" },
    interactive: { true: "hover-lift", false: "" },
  },
  defaultVariants: { tone: "default", padding: "md", interactive: false },
});

export type CardProps = ComponentProps<"section"> & VariantProps<typeof cardVariants>;

export function Card({ className, tone, padding, interactive, ...props }: CardProps) {
  return <section className={cn(cardVariants({ tone, padding, interactive }), className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mb-4 flex items-baseline justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-heading-md text-strong", className)} {...props} />;
}

export { cardVariants };
