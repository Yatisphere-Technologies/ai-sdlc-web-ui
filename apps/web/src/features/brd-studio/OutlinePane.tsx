import {
  addSection,
  type BrdCheck,
  type DocNode,
  deriveFromBody,
  moveSection,
  removeSection,
  restoreSection,
} from "@throughline/contracts";
import { cn } from "@throughline/ui";
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { placedSections } from "../brd/sections";
import type { LocalDoc } from "./useDocument";

type Update = (fn: (d: LocalDoc) => LocalDoc) => void;

/** Document outline: jump, reorder, hide and add sections. Every change is made to the document itself. */
export function OutlinePane({
  doc,
  update,
  readOnly,
  checks,
  onJump,
}: {
  doc: LocalDoc;
  update: Update;
  readOnly: boolean;
  checks: BrdCheck[];
  onJump: (id: string) => void;
}) {
  const placed = placedSections(doc, { includeHidden: true });
  const visible = placed.filter((p) => !p.hidden);
  const edit = (fn: (body: DocNode, d: LocalDoc) => DocNode) =>
    update((d) => {
      const body = fn(d.body, d);
      return { ...d, body, ...deriveFromBody(body, d.content) };
    });
  const toggle = (id: string, hidden: boolean, title: string) =>
    edit((body, d) => (hidden ? restoreSection(body, id, d.content, title) : removeSection(body, id)));

  return (
    <nav aria-label="Document outline" className="flex flex-col gap-1">
      <ol className="flex flex-col">
        {placed.map((p) => {
          const issues = checks.filter((c) => c.section === p.id);
          const errors = issues.some((c) => c.severity === "error");
          return (
            <li
              key={p.id}
              className={cn(
                "group hover:bg-surface-raised flex items-center gap-1 rounded-md pr-1",
                p.hidden && "opacity-50",
              )}
            >
              <button
                type="button"
                onClick={() => !p.hidden && onJump(p.id)}
                className="text-body-sm text-subtle hover:text-foreground flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-2 py-1.5 text-left"
              >
                <span className="text-nano text-ghost w-5 shrink-0 font-mono">
                  {p.hidden ? "–" : p.number}
                </span>
                <span className={cn("truncate", p.hidden && "line-through")}>{p.title}</span>
                {issues.length ? (
                  <span
                    className={cn("ml-auto size-1.5 shrink-0 rounded-full", errors ? "bg-risk" : "bg-gate")}
                  >
                    <span className="sr-only">{issues.length} issues</span>
                  </span>
                ) : null}
              </button>
              {!readOnly ? (
                <span className="flex shrink-0 items-center opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    aria-label={`Move ${p.title} up`}
                    disabled={p.hidden || visible[0]?.id === p.id}
                    onClick={() => edit((body) => moveSection(body, p.id, -1))}
                    className="text-ghost hover:text-foreground cursor-pointer p-0.5 disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${p.title} down`}
                    disabled={p.hidden || visible.at(-1)?.id === p.id}
                    onClick={() => edit((body) => moveSection(body, p.id, 1))}
                    className="text-ghost hover:text-foreground cursor-pointer p-0.5 disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  {p.kind === "custom" ? (
                    <button
                      type="button"
                      aria-label={`Delete ${p.title}`}
                      onClick={() => edit((body) => removeSection(body, p.id))}
                      className="text-ghost hover:text-risk cursor-pointer p-0.5"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={p.hidden ? `Show ${p.title}` : `Hide ${p.title}`}
                      onClick={() => toggle(p.id, p.hidden, p.title)}
                      className="text-ghost hover:text-foreground cursor-pointer p-0.5"
                    >
                      {p.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    </button>
                  )}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      {!readOnly ? (
        <button
          type="button"
          onClick={() => {
            const id = `custom-${Date.now().toString(36)}`;
            edit((body) => addSection(body, id, "New section"));
            setTimeout(() => onJump(id), 50);
          }}
          className="text-body-sm text-muted hover:bg-surface-raised hover:text-agent-fg mt-1 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5"
        >
          <Plus className="size-4" aria-hidden /> Add section
        </button>
      ) : null}
    </nav>
  );
}
