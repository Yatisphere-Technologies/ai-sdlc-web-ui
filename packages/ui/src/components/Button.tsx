import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const buttonVariants = cva(
  "press inline-flex cursor-pointer items-center justify-center gap-2 rounded-md font-sans font-semibold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Main action, usually agent-driven work */
        primary: "bg-agent text-agent-ink",
        /** A human decision at a gate */
        gate: "bg-gate text-gate-ink",
        secondary: "border-line-strong text-foreground border bg-transparent",
        ghost: "text-muted hover:bg-surface-raised hover:text-strong bg-transparent",
        danger: "border-risk-line bg-risk-soft text-risk-fg border",
      },
      size: {
        sm: "text-body-sm h-9 px-3",
        md: "text-body h-11 px-4",
        lg: "text-body-lg h-12 px-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. a router Link) with button styles */
    asChild?: boolean;
  };

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}

export { buttonVariants };
