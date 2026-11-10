import { Select } from "@throughline/ui";

/** Picks which item a delivery view shows; a plain label when there is only one. */
export function ItemPicker({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (items.length < 2) return <span className="text-micro text-muted font-mono">{items[0]?.label}</span>;
  return (
    <div className="max-w-xl">
      <Select
        label={label}
        variant="toolbar"
        value={value}
        onValueChange={onChange}
        options={items.map((i) => ({ value: i.id, label: i.label }))}
      />
    </div>
  );
}
