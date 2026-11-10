import { useQuery } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { reveal } from "@throughline/collab";
import { BrdList, STAGE_LABEL, WorkItemList } from "@throughline/contracts";
import { cn, Dialog, DialogContent, Kbd } from "@throughline/ui";
import { CornerDownLeft, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { hrefOf } from "@/features/approvals/links";
import { useAssistant } from "@/features/assistant";
import { MODULE_ROUTE, MODULES } from "@/features/modules";
import { usePortfolioQuery } from "@/features/projects";
import { useTenant } from "@/tenancy";
import { type CommandItem, searchCommands } from "./search";

const SETTINGS: [string, string][] = [
  ["Integrations", "/settings/integrations"],
  ["Security and data", "/settings/security"],
  ["Members and roles", "/settings/members"],
  ["Single sign-on", "/settings/sso"],
  ["Agents and guardrails", "/settings/agents"],
  ["Audit log", "/settings/audit"],
];

function useCommandItems(): CommandItem[] {
  const { api, keys } = useTenant();
  const portfolio = usePortfolioQuery().data;
  const brds = useQuery({ queryKey: keys.brds, queryFn: () => api.get("/brds", BrdList) }).data?.items;
  const work = useQuery({ queryKey: keys.workItems, queryFn: () => api.get("/work-items", WorkItemList) })
    .data?.items;
  return useMemo(() => {
    const out: CommandItem[] = MODULES.map((m) => ({
      id: `page-${m.id}`,
      group: "Pages",
      label: m.label,
      hint: m.description,
      path: MODULE_ROUTE[m.id].replace("/t/$tenantSlug", "") || "/",
    }));
    out.push(
      { id: "page-specs", group: "Pages", label: "Specs · G1", path: "/brd", search: { view: "specs" } },
      {
        id: "page-design",
        group: "Pages",
        label: "Design options",
        path: "/architecture",
        search: { view: "options" },
      },
      {
        id: "page-new-brd",
        group: "Pages",
        label: "New intent / new BRD",
        path: "/brd/new",
        keywords: "shape start idea",
      },
      { id: "page-ask", group: "Pages", label: "Assistant · full page", path: "/ask", keywords: "chat ask" },
      ...SETTINGS.map(([label, path]) => ({
        id: `set-${path}`,
        group: "Pages" as const,
        label,
        hint: "Settings",
        path,
      })),
    );
    for (const g of portfolio?.programs ?? [])
      out.push({
        id: `prg-${g.id}`,
        group: "Programs",
        label: `${g.key} · ${g.name}`,
        hint: g.owner,
        path: `/projects/program/${g.key}`,
      });
    for (const p of portfolio?.projects ?? [])
      out.push({
        id: `prj-${p.id}`,
        group: "Projects",
        label: `${p.key} · ${p.name}`,
        hint: p.owner,
        keywords: `${p.objective} ${p.teams.join(" ")}`,
        path: `/projects/${p.key}`,
      });
    for (const b of brds ?? [])
      out.push({
        id: `brd-${b.id}`,
        group: "BRDs",
        label: `${b.id} · ${b.title}`,
        hint: b.owner,
        path: `/brd/${b.id}`,
      });
    for (const w of work ?? []) {
      const key = portfolio?.projects.find((p) => p.id === w.projectId)?.key;
      if (key)
        out.push({
          id: `wi-${w.id}`,
          group: "Work items",
          label: `${w.key} · ${w.title}`,
          hint: `${STAGE_LABEL[w.stage]} · ${w.team}`,
          path: `/projects/${key}`,
          search: { tab: "work", item: w.key },
        });
    }
    return out;
  }, [portfolio, brds, work]);
}

/** ⌘K: jump to any page, program, project, BRD or work item, or hand the question to the assistant. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const { tenant } = useTenant();
  const router = useRouter();
  const assistant = useAssistant();
  const items = useCommandItems();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchCommands(items, q), [items, q]);
  const askIndex = results.length;
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);
  useEffect(() => {
    reveal(listRef.current?.querySelector(`[data-index="${active}"]`), { smooth: false, margin: 8 });
  }, [active]);

  const go = (i: number) => {
    onOpenChange(false);
    const item = results[i];
    if (item) router.history.push(hrefOf(tenant.slug, { path: item.path, search: item.search }));
    else if (q.trim()) assistant.open({ prompt: q.trim() });
    else assistant.open();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Search or ask" size="md" className="top-24 translate-y-0" hideClose>
        <div className="flex flex-col gap-3">
          <label className="border-line bg-surface focus-within:border-agent flex h-11 items-center gap-2 rounded-md border px-3">
            <Search className="text-muted size-4" aria-hidden />
            <span className="sr-only">Search pages, projects, BRDs and work items</span>
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="command-results"
              aria-activedescendant={`command-${active}`}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, askIndex));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  go(active);
                }
              }}
              placeholder="Jump to a project, BRD, work item… or ask"
              className="text-body text-foreground placeholder:text-faint h-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <div
            id="command-results"
            ref={listRef}
            role="listbox"
            aria-label="Results"
            className="flex flex-col gap-0.5"
          >
            {results.map((r, i) => (
              <div
                key={r.id}
                tabIndex={-1}
                id={`command-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(i)}
                onKeyDown={() => undefined}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2",
                  i === active ? "bg-surface-raised" : "",
                )}
              >
                <span className="text-micro text-faint w-20 shrink-0 font-mono">{r.group}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-sm text-foreground truncate">{r.label}</span>
                  {r.hint ? <span className="text-caption text-muted truncate">{r.hint}</span> : null}
                </span>
                {i === active ? (
                  <CornerDownLeft className="text-muted size-3.5 shrink-0" aria-hidden />
                ) : null}
              </div>
            ))}
            <div
              id={`command-${askIndex}`}
              tabIndex={-1}
              data-index={askIndex}
              role="option"
              aria-selected={active === askIndex}
              onMouseEnter={() => setActive(askIndex)}
              onClick={() => go(askIndex)}
              onKeyDown={() => undefined}
              className={cn(
                "border-line mt-1 flex cursor-pointer items-center gap-3 rounded-md border-t px-3 py-2.5",
                active === askIndex ? "bg-agent-wash" : "",
              )}
            >
              <Sparkles className="text-agent-fg size-4 shrink-0" aria-hidden />
              <span className="text-body-sm text-foreground flex-1 truncate">
                {q.trim() ? `Ask the assistant: “${q.trim()}”` : "Open the assistant"}
              </span>
              <Kbd>⌘J</Kbd>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** ⌘K / Ctrl+K opens the palette from anywhere in the workspace. */
export function useCommandShortcut(onOpen: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpen]);
}
