import { cn } from "@throughline/ui";
import type { ReactNode } from "react";

/** Vertical list of selectable items used by the module screens (specs, packs, incidents…). */
export function PickList<T extends { id: string }>({
  items,
  selectedId,
  onSelect,
  label,
  render,
}: {
  items: readonly T[];
  selectedId: string;
  onSelect: (id: string) => void;
  label: string;
  render: (item: T) => ReactNode;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={item.id === selectedId}
          onClick={() => onSelect(item.id)}
          className={cn(
            "hover-lift flex cursor-pointer flex-col gap-1.5 rounded-lg border-2 p-3.5 text-left",
            item.id === selectedId ? "border-agent bg-agent-wash" : "border-line bg-surface",
          )}
        >
          {render(item)}
        </button>
      ))}
    </nav>
  );
}
