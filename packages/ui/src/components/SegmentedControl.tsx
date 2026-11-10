import { ToggleGroup } from "radix-ui";
import { cn } from "../lib/cn";

export type SegmentedOption<T extends string> = { value: T; label: string };

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        if (next) onValueChange(next as T);
      }}
      className={cn("border-line bg-surface inline-flex rounded-lg border p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="press text-body-sm text-muted data-[state=on]:bg-agent data-[state=on]:text-agent-ink h-9 cursor-pointer rounded-md px-4 font-semibold"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
