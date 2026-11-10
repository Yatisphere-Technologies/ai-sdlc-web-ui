import { Switch as SwitchPrimitive } from "radix-ui";
import { useId } from "react";
import { cn } from "../lib/cn";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** Highlight when off, for controls that weaken security */
  warnWhenOff?: boolean;
  className?: string;
};

/** A full-width row with label, optional help text and a switch. */
export function SwitchRow({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  warnWhenOff,
  className,
}: SwitchProps) {
  const id = useId();
  const warn = warnWhenOff && !checked;
  return (
    <div
      className={cn(
        "bg-surface-raised flex min-h-14 items-center justify-between gap-4 rounded-md border px-3 py-2",
        warn ? "border-gate-line" : "border-line",
        className,
      )}
    >
      <label htmlFor={id} className="flex min-w-0 cursor-pointer flex-col gap-0.5">
        <span className="text-body text-foreground">{label}</span>
        {description ? (
          <span className={cn("text-caption", warn ? "text-gate-fg" : "text-muted")}>{description}</span>
        ) : null}
      </label>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="bg-line-strong data-[state=checked]:bg-agent relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        <SwitchPrimitive.Thumb className="bg-strong ease-spring block size-4 translate-x-1 rounded-full transition-transform duration-200 data-[state=checked]:translate-x-5" />
      </SwitchPrimitive.Root>
    </div>
  );
}
