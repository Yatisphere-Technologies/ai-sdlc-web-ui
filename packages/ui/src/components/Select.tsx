import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { Select as Primitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { type Tone, toneFill } from "../lib/tone";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  /** A second line under the label in the list. */
  description?: string;
  icon?: ReactNode;
  /** Small text on the right of the item, e.g. a count. */
  meta?: string;
  /** Coloured dot before the label (status, priority). */
  dot?: Tone;
  /** Items with the same group are listed under that heading. */
  group?: string;
  disabled?: boolean;
};

/** Radix reserves "" for "no value", so empty values travel under this key. */
const EMPTY = "__empty__";
const toKey = (v: string) => (v === "" ? EMPTY : v);
const fromKey = (v: string) => (v === EMPTY ? "" : v);

const TRIGGER = {
  field:
    "border-line bg-surface-sunken hover:border-line-strong data-[state=open]:border-agent focus-visible:border-agent rounded-md border px-2.5",
  toolbar:
    "border-line bg-surface hover:border-line-strong hover:bg-surface-raised data-[state=open]:border-agent focus-visible:border-agent rounded-md border px-2.5",
  inline:
    "hover:border-line data-[state=open]:border-agent focus-visible:border-agent rounded-md border border-transparent px-1",
} as const;

const SIZE = {
  sm: "h-8 text-caption gap-1.5",
  md: "h-9 text-body-sm gap-2",
  lg: "h-11 text-body gap-2",
} as const;

function Leading({ o }: { o?: SelectOption }) {
  if (!o) return null;
  if (o.icon) return <span className="text-muted flex shrink-0 items-center">{o.icon}</span>;
  if (o.dot) return <span className={cn("size-2 shrink-0 rounded-full", toneFill[o.dot])} aria-hidden />;
  return null;
}

/**
 * A styled, keyboard-accessible select: themed trigger, a popover list with descriptions, icons,
 * status dots, counts, groups and a check on the chosen item. Use it instead of a native <select>.
 */
export function Select<T extends string>({
  value,
  onValueChange,
  options,
  label,
  placeholder = "Choose…",
  prefix,
  variant = "field",
  size = "md",
  disabled,
  className,
  contentClassName,
  align = "start",
  id,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly SelectOption<T>[];
  /** Accessible name (also used as the list's label). */
  label: string;
  placeholder?: string;
  /** Muted text before the value in the trigger, e.g. "Release". */
  prefix?: string;
  variant?: keyof typeof TRIGGER;
  size?: keyof typeof SIZE;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
  align?: "start" | "center" | "end";
  id?: string;
}) {
  const current = options.find((o) => o.value === value);
  const groups: { name: string | undefined; items: SelectOption<T>[] }[] = [];
  for (const o of options) {
    const g = groups.find((x) => x.name === o.group);
    if (g) g.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }
  return (
    <Primitive.Root
      value={toKey(value)}
      onValueChange={(v) => onValueChange(fromKey(v) as T)}
      disabled={disabled}
    >
      <Primitive.Trigger
        id={id}
        aria-label={label}
        className={cn(
          "text-foreground inline-flex min-w-0 cursor-pointer items-center outline-none disabled:cursor-default disabled:opacity-60",
          TRIGGER[variant],
          SIZE[size],
          className,
        )}
      >
        {prefix ? <span className="text-muted shrink-0">{prefix}</span> : null}
        <Leading o={current} />
        <span className={cn("min-w-0 flex-1 truncate text-left", !current && "text-faint")}>
          <Primitive.Value placeholder={placeholder}>{current?.label}</Primitive.Value>
        </span>
        <Primitive.Icon asChild>
          <ChevronDown className="text-muted size-3.5 shrink-0" aria-hidden />
        </Primitive.Icon>
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          position="popper"
          sideOffset={6}
          align={align}
          aria-label={label}
          className={cn(
            "border-line-strong bg-surface shadow-lift animate-rise z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-lg border",
            contentClassName,
          )}
        >
          <Primitive.ScrollUpButton className="text-muted flex h-6 items-center justify-center">
            <ChevronUp className="size-4" aria-hidden />
          </Primitive.ScrollUpButton>
          <Primitive.Viewport className="p-1.5">
            {groups.map((g, n) => (
              <Primitive.Group key={g.name ?? `group-${n}`}>
                {n > 0 ? <Primitive.Separator className="bg-line mx-1 my-1.5 h-px" /> : null}
                {g.name ? (
                  <Primitive.Label className="eyebrow text-faint px-2.5 pt-1.5 pb-1">
                    {g.name}
                  </Primitive.Label>
                ) : null}
                {g.items.map((o) => (
                  <Primitive.Item
                    key={o.value}
                    value={toKey(o.value)}
                    disabled={o.disabled}
                    className="text-body-sm text-foreground data-[highlighted]:bg-surface-raised data-[state=checked]:text-strong relative flex cursor-pointer items-center gap-2.5 rounded-md py-2 pr-8 pl-2.5 outline-none select-none data-[disabled]:cursor-default data-[disabled]:opacity-50"
                  >
                    <Leading o={o} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <Primitive.ItemText>{o.label}</Primitive.ItemText>
                      {o.description ? (
                        <span className="text-caption text-muted truncate">{o.description}</span>
                      ) : null}
                    </span>
                    {o.meta ? (
                      <span className="text-micro text-faint shrink-0 font-mono">{o.meta}</span>
                    ) : null}
                    <Primitive.ItemIndicator className="text-agent-fg absolute right-2.5 flex items-center">
                      <Check className="size-4" aria-hidden />
                    </Primitive.ItemIndicator>
                  </Primitive.Item>
                ))}
              </Primitive.Group>
            ))}
          </Primitive.Viewport>
          <Primitive.ScrollDownButton className="text-muted flex h-6 items-center justify-center">
            <ChevronDown className="size-4" aria-hidden />
          </Primitive.ScrollDownButton>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
