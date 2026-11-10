import { type Backlog, type BacklogItem, isPushable, storyChecks, TOOL_LABEL } from "@throughline/contracts";
import { Badge, cn, Tooltip } from "@throughline/ui";
import { ChevronDown, ChevronRight, CircleAlert, Link2 } from "lucide-react";
import { type Index, rollup } from "./meta";
import { KindBadge, PRIORITY, TYPE } from "./parts";

/**
 * The backlog as a hierarchy: epic → feature → story → sub-task, with release, priority, size,
 * sprint, owner and readiness. Columns drop away as the panel narrows (container queries).
 */
export function BacklogTree({
  backlog,
  ix,
  open,
  onToggle,
  visible,
  selected,
  onSelect,
}: {
  backlog: Backlog;
  ix: Index;
  open: Set<string>;
  onToggle: (id: string) => void;
  /** null = everything. */
  visible: Set<string> | null;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const rows: { item: BacklogItem; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const i of ix.children.get(parent) ?? []) {
      if (visible && i.type !== "subtask" && !visible.has(i.id)) continue;
      rows.push({ item: i, depth });
      if (open.has(i.id) || (visible && i.type !== "story")) walk(i.id, depth + 1);
    }
  };
  walk(null, 0);

  const head = "eyebrow text-muted px-3 py-2.5 text-left font-normal";
  return (
    <table className="text-body-sm w-full table-fixed border-collapse">
      <thead className="bg-surface-raised sticky top-0 z-10">
        <tr>
          <th scope="col" className={head}>
            Work item
          </th>
          <th scope="col" className={cn(head, "w-32 @max-3xl:hidden")}>
            Kind
          </th>
          <th scope="col" className={cn(head, "w-28 @max-2xl:hidden")}>
            Release
          </th>
          <th scope="col" className={cn(head, "w-28")}>
            Priority
          </th>
          <th scope="col" className={cn(head, "w-16 text-right")}>
            Size
          </th>
          <th scope="col" className={cn(head, "w-24 @max-xl:hidden")}>
            Sprint
          </th>
          <th scope="col" className={cn(head, "w-44 @max-5xl:hidden")}>
            Owner
          </th>
          <th scope="col" className={cn(head, "w-28 @max-4xl:hidden")}>
            {TOOL_LABEL[backlog.target]}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ item, depth }) => {
          const T = TYPE[item.type];
          const hasKids = (ix.children.get(item.id) ?? []).length > 0;
          const issues = storyChecks(item).length;
          const r = rollup(ix, item);
          return (
            <tr
              key={item.id}
              aria-selected={selected === item.id}
              className={cn(
                "border-line hover:bg-surface-raised border-t",
                item.type === "epic" && "bg-surface",
                selected === item.id && "bg-agent-wash hover:bg-agent-wash",
              )}
            >
              <td className="px-3 py-2">
                <div
                  className="flex min-w-0 items-center gap-1.5"
                  // Indent by depth; the depth is data, not a design value.
                  style={{ paddingLeft: `${depth * 1.25}rem` }}
                >
                  {hasKids ? (
                    <button
                      type="button"
                      aria-label={open.has(item.id) ? `Collapse ${item.title}` : `Expand ${item.title}`}
                      aria-expanded={open.has(item.id)}
                      onClick={() => onToggle(item.id)}
                      className="text-muted hover:text-foreground cursor-pointer"
                    >
                      {open.has(item.id) ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <T.Icon className={cn("size-4 shrink-0", T.color)} aria-label={T.label} />
                  <span className="text-micro text-faint shrink-0 font-mono">{item.id}</span>
                  <Tooltip content={item.title} side="bottom" align="start">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className={cn(
                        "min-w-0 cursor-pointer truncate text-left hover:underline",
                        item.type === "epic"
                          ? "text-strong font-semibold"
                          : item.type === "subtask"
                            ? "text-subtle"
                            : "text-foreground",
                      )}
                    >
                      {item.title}
                    </button>
                  </Tooltip>
                  {item.dependsOn.length ? (
                    <Link2
                      className="text-muted size-3.5 shrink-0"
                      aria-label={`Depends on ${item.dependsOn.join(", ")}`}
                    />
                  ) : null}
                  {issues > 0 ? (
                    <CircleAlert
                      className="text-gate size-3.5 shrink-0"
                      aria-label={`${issues} readiness issues`}
                    />
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2 @max-3xl:hidden">
                {item.type === "subtask" ? null : item.kind === "business" ? (
                  <span className="text-caption text-muted">Business</span>
                ) : (
                  <KindBadge kind={item.kind} />
                )}
                {item.type !== "subtask" ? null : (
                  <span className="text-caption text-muted">{item.taskKind}</span>
                )}
              </td>
              <td className="text-caption text-muted px-3 py-2 whitespace-nowrap @max-2xl:hidden">
                {item.type !== "subtask" ? item.release : ""}
              </td>
              <td className="px-3 py-2">
                {item.type !== "subtask" ? (
                  <Badge tone={PRIORITY[item.priority].tone} mono>
                    {PRIORITY[item.priority].label}
                  </Badge>
                ) : null}
              </td>
              <td className="text-micro text-subtle px-3 py-2 text-right font-mono whitespace-nowrap">
                {item.type === "subtask" ? `${item.hours ?? "–"}h` : `${r.points}pt`}
              </td>
              <td className="text-caption text-muted px-3 py-2 whitespace-nowrap @max-xl:hidden">
                {item.type === "story" ? item.iteration : ""}
              </td>
              <td className="text-caption text-muted max-w-48 truncate px-3 py-2 @max-5xl:hidden">
                {item.type === "subtask" ? "" : item.owner}
              </td>
              <td className="text-micro text-ok px-3 py-2 font-mono whitespace-nowrap @max-4xl:hidden">
                {item.external?.key ??
                  (isPushable(backlog.target, item) ? "" : <span className="text-faint">as label</span>)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
