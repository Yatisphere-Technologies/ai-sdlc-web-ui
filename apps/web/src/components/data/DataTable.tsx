import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { cn, EmptyState } from "@throughline/ui";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { type ReactNode, useState } from "react";

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData, TValue> {
    /** Right-align numbers. */
    align?: "right";
    /** Hide below this breakpoint. */
    hideBelow?: "md" | "lg" | "xl" | "2xl";
    className?: string;
  }
}

const HIDE = {
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
} as const;

/**
 * Sortable, searchable table on TanStack Table, styled with our tokens. Rows can open something:
 * `onRowOpen` makes the whole row clickable and keyboard-operable (Enter), so put a real link in
 * the first cell as well for middle-click and screen readers.
 */
export function DataTable<T>({
  data,
  columns,
  label,
  initialSort = [],
  search,
  toolbar,
  onRowOpen,
  rowClassName,
  empty = "Nothing to show",
}: {
  data: T[];
  // biome-ignore lint/suspicious/noExplicitAny: column value types differ per column
  columns: ColumnDef<T, any>[];
  /** Accessible name of the table. */
  label: string;
  initialSort?: SortingState;
  /** Placeholder for the search box; omit to hide it. */
  search?: string;
  /** Extra controls next to the search box. */
  toolbar?: ReactNode;
  onRowOpen?: (row: T) => void;
  rowClassName?: (row: Row<T>) => string | undefined;
  empty?: string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort);
  const [filter, setFilter] = useState("");
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  const rows = table.getRowModel().rows;
  return (
    <div className="flex flex-col gap-3">
      {search || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {search ? (
            <label className="border-line bg-surface focus-within:border-agent flex h-9 min-w-56 flex-1 items-center gap-1.5 rounded-md border px-2.5 sm:max-w-sm">
              <Search className="text-muted size-4" aria-hidden />
              <span className="sr-only">Search {label}</span>
              <input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={search}
                className="text-body-sm text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
          ) : null}
          {toolbar}
          <span className="text-caption text-muted ml-auto">
            {rows.length === data.length ? `${data.length}` : `${rows.length} of ${data.length}`}
          </span>
        </div>
      ) : null}
      <div className="border-line bg-surface relative overflow-x-auto rounded-xl border">
        <table className="w-full text-left" aria-label={label}>
          <thead className="bg-surface-raised">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-line border-b">
                {hg.headers.map((h) => {
                  const meta = h.column.columnDef.meta;
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  return (
                    <th
                      key={h.id}
                      scope="col"
                      aria-sort={
                        sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined
                      }
                      className={cn(
                        "text-caption text-muted px-3 py-2.5 font-medium whitespace-nowrap",
                        meta?.align === "right" && "text-right",
                        meta?.hideBelow && HIDE[meta.hideBelow],
                      )}
                    >
                      {h.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          className={cn(
                            "hover:text-foreground inline-flex cursor-pointer items-center gap-1",
                            meta?.align === "right" && "flex-row-reverse",
                            sorted && "text-foreground",
                          )}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3" aria-hidden />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="text-ghost size-3" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                tabIndex={onRowOpen ? 0 : undefined}
                onClick={
                  onRowOpen
                    ? (e) => {
                        // Let links, buttons and menus inside the row do their own thing.
                        if ((e.target as HTMLElement).closest("a,button,[role=menuitem]")) return;
                        onRowOpen(r.original);
                      }
                    : undefined
                }
                onKeyDown={
                  onRowOpen
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onRowOpen(r.original);
                      }
                    : undefined
                }
                className={cn(
                  "border-line border-b last:border-0",
                  onRowOpen &&
                    "hover:bg-surface-raised focus-visible:bg-surface-raised cursor-pointer outline-none",
                  rowClassName?.(r),
                )}
              >
                {r.getVisibleCells().map((c) => {
                  const meta = c.column.columnDef.meta;
                  return (
                    <td
                      key={c.id}
                      className={cn(
                        "text-body-sm px-3 py-3 align-middle",
                        meta?.align === "right" && "text-right",
                        meta?.hideBelow && HIDE[meta.hideBelow],
                        meta?.className,
                      )}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <EmptyState title={empty} className="border-0" /> : null}
      </div>
    </div>
  );
}
