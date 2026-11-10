import { cn, Select } from "@throughline/ui";
import type { ReactNode } from "react";

/**
 * Edit-in-place controls: they read as normal document text and become fields on hover and focus,
 * so the author edits the BRD where they read it. With readOnly they render plain text.
 */

const FIELD =
  "-mx-1.5 w-[calc(100%+0.75rem)] resize-none rounded-md border border-transparent bg-transparent px-1.5 py-0.5 outline-none transition-colors field-sizing-content placeholder:text-ghost hover:border-line focus:border-agent focus:bg-surface-sunken";

export function InlineText({
  value,
  onChange,
  readOnly,
  label,
  placeholder,
  className,
  multiline = true,
}: {
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  label: string;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
}) {
  if (readOnly) {
    return value ? (
      <span className={cn("whitespace-pre-line", className)}>{value}</span>
    ) : (
      <span className={cn("text-ghost italic", className)}>{placeholder ?? "—"}</span>
    );
  }
  return multiline ? (
    <textarea
      aria-label={label}
      rows={1}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD, "block min-h-7", className)}
    />
  ) : (
    <input
      aria-label={label}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(FIELD, "block", className)}
    />
  );
}

export function InlineSelect({
  value,
  options,
  onChange,
  readOnly,
  label,
  className,
  render,
}: {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
  readOnly: boolean;
  label: string;
  className?: string;
  render?: (v: string) => ReactNode;
}) {
  if (readOnly)
    return (
      <span className={className}>
        {render ? render(value) : (options.find((o) => o.value === value)?.label ?? value)}
      </span>
    );
  return (
    <Select
      label={label}
      variant="inline"
      size="sm"
      value={value}
      onValueChange={onChange}
      options={options}
      className={cn("h-auto py-0.5", className)}
    />
  );
}
