import {
  type Architecture,
  DIAGRAM_LABEL,
  type Diagram,
  type DiagramCategory,
  type EdgeKind,
} from "@throughline/contracts";
import { Badge, Button, Card, cn, Eyebrow, Tooltip } from "@throughline/ui";
import { Download, Maximize2, Minimize2, Scan, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ComponentPanel } from "./ComponentPanel";
import { DiagramCanvas } from "./DiagramCanvas";
import { CATEGORY, EDGE } from "./diagramStyle";
import { download, standaloneSvg } from "./export/download";
import { SequenceCanvas } from "./SequenceCanvas";
import { clampZoom, fitZoom } from "./zoom";

function Legend({ d }: { d: Diagram }) {
  const cats = [...new Set(d.nodes.map((n) => n.category))] as DiagramCategory[];
  const kinds = [
    ...new Set(d.kind === "sequence" ? (d.messages ?? []).map((m) => m.kind) : d.edges.map((e) => e.kind)),
  ] as EdgeKind[];
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>Legend</Eyebrow>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {cats.map((c) => (
          <li key={c} className="text-caption text-subtle flex items-center gap-2">
            <svg width="12" height="12" aria-hidden className="shrink-0">
              <rect
                x="1"
                y="1"
                width="10"
                height="10"
                rx="3"
                className={cn(CATEGORY[c].soft, CATEGORY[c].stroke)}
              />
            </svg>
            {CATEGORY[c].name}
          </li>
        ))}
      </ul>
      <ul className="flex flex-col gap-1.5">
        {kinds.map((k) => (
          <li key={k} className="text-caption text-subtle flex items-center gap-2">
            <svg width="28" height="8" aria-hidden className="shrink-0">
              <line
                x1="0"
                y1="4"
                x2="28"
                y2="4"
                className={EDGE[k].stroke}
                strokeWidth="2"
                strokeDasharray={EDGE[k].dash}
              />
            </svg>
            {EDGE[k].name}
          </li>
        ))}
        {d.edges.some((e) => e.control) ? (
          <li className="text-caption text-subtle flex items-center gap-2">
            <Badge tone="risk" mono>
              C3
            </Badge>
            Security control (see document §8)
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Tabbed diagram viewer with zoom, focus-on-hover, a details panel and per-diagram SVG export. */
export function DiagramViewer({
  arch,
  active,
  onActive,
  slug,
}: {
  arch: Architecture;
  active: string;
  onActive: (id: string) => void;
  slug: string;
}) {
  const diagram = arch.diagrams.find((d) => d.id === active) ?? arch.diagrams[0];
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const node = selected ? diagram?.nodes.find((n) => n.id === selected) : undefined;
  const component = node ? arch.components.find((c) => c.id === (node.component ?? node.id)) : undefined;
  const [hovered, setHovered] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);

  const [expanded, setExpanded] = useState(false);

  /** Readable zoom on load and resize; `whole` shrinks further so the entire diagram is in view. */
  const fitView = useCallback(
    (whole = false) => {
      const el = frame.current;
      if (!diagram || !el) return;
      const z = fitZoom({ width: el.clientWidth, height: el.clientHeight }, diagram, !whole);
      if (z !== null) setZoom(z);
    },
    [diagram],
  );

  useLayoutEffect(() => {
    setSelected(null);
    fitView(expanded);
  }, [fitView, expanded]);
  useEffect(() => {
    const onResize = () => fitView(expanded);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitView, expanded]);

  // Full-screen view: Esc closes it, and the page behind doesn't scroll.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  const stats = useMemo(
    () =>
      diagram
        ? diagram.kind === "sequence"
          ? `${diagram.nodes.length} participants · ${diagram.messages?.length ?? 0} steps`
          : `${diagram.nodes.length} components · ${diagram.edges.length} connections · ${diagram.groups.length} boundaries`
        : "",
    [diagram],
  );

  if (!diagram) return null;

  const exportSvg = () => {
    if (!svg.current) return;
    setSelected(null);
    setHovered(null);
    requestAnimationFrame(() => {
      if (svg.current) download(`${slug}-${diagram.kind}.svg`, standaloneSvg(svg.current), "image/svg+xml");
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Diagrams" className="flex flex-wrap gap-2">
        {arch.diagrams.map((d, i) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === diagram.id}
            onClick={() => onActive(d.id)}
            className={cn(
              "press text-body-sm flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 font-semibold",
              d.id === diagram.id
                ? "border-agent bg-agent-wash text-agent-fg"
                : "border-line bg-surface text-muted hover:text-foreground",
            )}
          >
            <span className="text-micro font-mono opacity-70">{i + 1}</span>
            {DIAGRAM_LABEL[d.kind]}
          </button>
        ))}
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card
          padding="none"
          role={expanded ? "dialog" : undefined}
          aria-modal={expanded || undefined}
          aria-label={expanded ? diagram.title : undefined}
          className={cn(
            "flex min-w-0 flex-col overflow-hidden",
            expanded && "fixed inset-0 z-50 rounded-none border-0",
          )}
        >
          <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex min-w-0 flex-col">
              <span className="text-body text-strong font-semibold">{diagram.title}</span>
              <span className="text-caption text-muted">{stats}</span>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip content="Zoom out">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Zoom out"
                  disabled={zoom <= 0.25}
                  onClick={() => setZoom((z) => clampZoom(z - 0.15))}
                >
                  <ZoomOut className="size-4" aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content="Reset to 100%">
                <button
                  type="button"
                  aria-label={`Zoom ${Math.round(zoom * 100)}%, reset to 100%`}
                  onClick={() => setZoom(1)}
                  className="text-micro text-muted hover:text-foreground w-12 cursor-pointer rounded-md py-1 text-center font-mono"
                >
                  {Math.round(zoom * 100)}%
                </button>
              </Tooltip>
              <Tooltip content="Zoom in">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Zoom in"
                  disabled={zoom >= 2}
                  onClick={() => setZoom((z) => clampZoom(z + 0.15))}
                >
                  <ZoomIn className="size-4" aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip content="Fit whole diagram">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Fit whole diagram"
                  onClick={() => fitView(true)}
                >
                  <Scan className="size-4" aria-hidden />
                </Button>
              </Tooltip>
              <Tooltip
                content={expanded ? "Exit full screen" : "Full screen"}
                shortcut={expanded ? "Esc" : undefined}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={expanded ? "Exit full screen" : "Full screen"}
                  aria-pressed={expanded}
                  onClick={() => setExpanded((x) => !x)}
                >
                  {expanded ? (
                    <Minimize2 className="size-4" aria-hidden />
                  ) : (
                    <Maximize2 className="size-4" aria-hidden />
                  )}
                </Button>
              </Tooltip>
              <Button variant="secondary" size="sm" onClick={exportSvg}>
                <Download className="size-3.5" aria-hidden /> SVG
              </Button>
            </div>
          </div>
          <div className={cn("relative flex min-h-0", expanded && "flex-1")}>
            <div
              ref={frame}
              className={cn(
                "bg-background min-w-0 flex-1 overflow-auto p-2",
                expanded ? "min-h-0" : "max-h-screen",
              )}
            >
              {diagram.kind === "sequence" ? (
                <SequenceCanvas
                  ref={svg}
                  diagram={diagram}
                  zoom={zoom}
                  cloud={arch.brief.cloud}
                  selected={selected}
                  onSelect={setSelected}
                />
              ) : (
                <DiagramCanvas
                  ref={svg}
                  diagram={diagram}
                  cloud={arch.brief.cloud}
                  zoom={zoom}
                  selected={selected}
                  hovered={hovered}
                  onSelect={setSelected}
                  onHover={setHovered}
                />
              )}
            </div>
            {expanded && component && selected ? (
              <aside
                aria-label={`${component.name} details`}
                className="border-line bg-surface shadow-raise absolute inset-y-0 right-0 w-md max-w-full overflow-y-auto border-l p-5"
              >
                <div className="mb-3 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                    Close
                  </Button>
                </div>
                <ComponentPanel
                  arch={arch}
                  component={component}
                  diagram={diagram}
                  nodeId={selected}
                  onSelect={setSelected}
                />
              </aside>
            ) : null}
          </div>
          <p className="border-line text-caption text-muted border-t px-4 py-2.5">{diagram.caption}</p>
        </Card>
        <Card padding="lg" className="flex max-h-screen flex-col gap-6 overflow-y-auto xl:sticky xl:top-24">
          {component && selected ? (
            <ComponentPanel
              arch={arch}
              component={component}
              diagram={diagram}
              nodeId={selected}
              onSelect={setSelected}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-body text-strong font-semibold">Click any component</span>
              <p className="text-body-sm text-subtle">
                Every box has an <span className="font-mono">i</span>: click it to see what the component does
                in this solution, which requirements and decisions it serves, how it's configured, what it
                costs and the choices that would change it. Hover to trace its lines.
              </p>
            </div>
          )}
          <Legend d={diagram} />
          {diagram.kind === "sequence" ? (
            <ol className="flex flex-col gap-1.5">
              {(diagram.messages ?? [])
                .filter((m) => m.note)
                .map((m) => (
                  <li key={m.step} className="text-caption text-subtle">
                    <span className="text-agent-fg font-mono">{m.step}.</span> {m.note}
                  </li>
                ))}
            </ol>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
