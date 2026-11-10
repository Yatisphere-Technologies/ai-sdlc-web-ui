import { cn } from "@throughline/ui";
import type { Editor } from "@tiptap/react";
import { type MutableRefObject, type ReactNode, useEffect, useState } from "react";

export type SlashItem = {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  group: string;
  keywords?: string[];
};

type Open = { query: string; from: number; to: number; x: number; y: number };

/** "/" at the start of an empty line: the query typed after it, or null. */
export function slashQuery(textBefore: string): string | null {
  const m = /^\/([\w -]{0,30})$/.exec(textBefore);
  return m ? (m[1] ?? "") : null;
}

export function filterSlash(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((i) =>
    [i.label, ...(i.keywords ?? [])].some(
      (w) => w.toLowerCase().includes(q) || q.split(" ").every((p) => w.toLowerCase().includes(p)),
    ),
  );
}

/** The "/" block menu: type / on an empty line, filter by typing, arrows to move, Enter to insert. */
export function SlashMenu({
  editor,
  items,
  onRun,
  keyHandler,
}: {
  editor: Editor;
  items: SlashItem[];
  onRun: (id: string, range: { from: number; to: number }) => void;
  keyHandler: MutableRefObject<((e: KeyboardEvent) => boolean) | null>;
}) {
  const [open, setOpen] = useState<Open | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const check = () => {
      const { selection } = editor.state;
      const { $from, empty } = selection;
      if (!empty || $from.parent.type.name !== "paragraph") return setOpen(null);
      const q = slashQuery($from.parent.textBetween(0, $from.parentOffset, "\n", "\n"));
      if (q === null) return setOpen(null);
      const c = editor.view.coordsAtPos($from.pos);
      setOpen((prev) => {
        if (prev?.query !== q) setIndex(0);
        return { query: q, from: $from.start(), to: $from.pos, x: c.left, y: c.bottom };
      });
    };
    editor.on("transaction", check);
    return () => {
      editor.off("transaction", check);
    };
  }, [editor]);

  const shown = open ? filterSlash(items, open.query) : [];

  useEffect(() => {
    keyHandler.current = (e) => {
      if (!open || !shown.length) return false;
      if (e.key === "ArrowDown") {
        setIndex((i) => (i + 1) % shown.length);
        return true;
      }
      if (e.key === "ArrowUp") {
        setIndex((i) => (i - 1 + shown.length) % shown.length);
        return true;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        const item = shown[index];
        if (item) onRun(item.id, { from: open.from, to: open.to });
        setOpen(null);
        return true;
      }
      if (e.key === "Escape") {
        setOpen(null);
        return true;
      }
      return false;
    };
  }, [open, shown, index, onRun, keyHandler]);

  if (!open || !shown.length) return null;
  let group = "";
  return (
    <div
      role="listbox"
      aria-label="Insert a block"
      className="border-line-strong bg-surface shadow-raise animate-pop fixed z-50 flex max-h-80 w-72 flex-col overflow-y-auto rounded-lg border p-1"
      // Positioned at the caret; these are layout coordinates, not design values.
      style={{
        left: Math.min(open.x, window.innerWidth - 300),
        top: Math.min(open.y + 6, window.innerHeight - 330),
      }}
    >
      {shown.map((item, i) => {
        const head = item.group !== group ? item.group : null;
        group = item.group;
        return (
          <div key={item.id}>
            {head ? <div className="eyebrow text-faint px-2.5 pt-2 pb-1">{head}</div> : null}
            <button
              type="button"
              role="option"
              aria-selected={i === index}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                onRun(item.id, { from: open.from, to: open.to });
                setOpen(null);
              }}
              className={cn(
                "flex w-full cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left",
                i === index ? "bg-surface-raised" : "",
              )}
            >
              {item.icon ? <span className="text-muted mt-0.5 shrink-0">{item.icon}</span> : null}
              <span className="flex min-w-0 flex-col">
                <span className="text-body-sm text-foreground">{item.label}</span>
                {item.description ? (
                  <span className="text-caption text-faint">{item.description}</span>
                ) : null}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
