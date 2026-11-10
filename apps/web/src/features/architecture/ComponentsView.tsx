import type { ArchComponent, Architecture, DiagramCategory } from "@throughline/contracts";
import { Badge, Card, cn } from "@throughline/ui";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ComponentIcon, ComponentPanel } from "./ComponentPanel";
import { CATEGORY } from "./diagramStyle";

const ORDER: DiagramCategory[] = [
  "person",
  "edge",
  "compute",
  "integration",
  "data",
  "ai",
  "identity",
  "security",
  "network",
  "ops",
  "external",
  "system",
];

/** Every component in the design, grouped by kind, with the full explanation alongside. */
export function ComponentsView({ arch }: { arch: Architecture }) {
  const [query, setQuery] = useState("");
  const [id, setId] = useState<string | null>(
    arch.components.find((c) => c.choice)?.id ?? arch.components[0]?.id ?? null,
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return arch.components.filter(
      (c) =>
        !q ||
        [c.name, c.product, c.purpose, ...c.serves.map((s) => `${s.id} ${s.label}`)].some((x) =>
          x.toLowerCase().includes(q),
        ),
    );
  }, [arch.components, query]);
  const selected = arch.components.find((c) => c.id === id);
  const total = arch.components.reduce((a, c) => a + (c.monthlyUsd ?? 0), 0);
  const traced = arch.components.filter((c) =>
    c.serves.some((s) => s.kind === "requirement" || s.kind === "nfr"),
  ).length;
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
      <Card padding="none" className="flex flex-col overflow-hidden">
        <div className="border-line flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span className="text-body text-strong font-semibold">{arch.components.length} components</span>
          <span className="text-caption text-muted">
            {traced} traced to the BRD · ~${Math.round(total).toLocaleString("en-US")}/month listed
          </span>
          <label className="border-line bg-surface-sunken focus-within:border-agent ml-auto flex h-9 w-64 max-w-full items-center gap-2 rounded-md border px-2.5">
            <Search className="text-muted size-4" aria-hidden />
            <span className="sr-only">Filter components</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name, product or BR-…"
              className="text-body-sm text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
        </div>
        <div className="flex flex-col">
          {ORDER.filter((k) => shown.some((c) => c.category === k)).map((k) => (
            <section key={k} className="border-line flex flex-col border-b last:border-b-0">
              <h3 className="eyebrow text-muted px-4 pt-3 pb-1.5">{CATEGORY[k].name}</h3>
              <ul className="flex flex-col pb-2">
                {shown
                  .filter((c) => c.category === k)
                  .map((c) => (
                    <li key={c.id}>
                      <Row c={c} arch={arch} active={c.id === id} onClick={() => setId(c.id)} />
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          {shown.length === 0 ? <p className="text-body-sm text-muted p-4">No component matches.</p> : null}
        </div>
      </Card>
      <Card padding="lg" className="max-h-screen overflow-y-auto xl:sticky xl:top-24">
        {selected ? <ComponentPanel arch={arch} component={selected} /> : null}
      </Card>
    </div>
  );
}

function Row({
  c,
  arch,
  active,
  onClick,
}: {
  c: ArchComponent;
  arch: Architecture;
  active: boolean;
  onClick: () => void;
}) {
  const reqs = c.serves.filter((s) => s.kind === "requirement").length;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors",
        active ? "bg-agent-wash" : "hover:bg-surface-raised",
      )}
    >
      <ComponentIcon c={c} cloud={arch.brief.cloud} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-body-sm text-foreground truncate font-medium">{c.name}</span>
        <span className="text-caption text-muted truncate">
          {c.product} · {c.purpose}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {reqs ? <Badge tone="agent">{reqs} BR</Badge> : null}
        {c.choice ? <Badge tone="ion">Choice</Badge> : null}
        {c.status === "preview" ? <Badge tone="gate">Preview</Badge> : null}
      </span>
    </button>
  );
}
