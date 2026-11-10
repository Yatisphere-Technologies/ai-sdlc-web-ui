import type { Cloud, Diagram, DiagramGroup, DiagramNode, EdgeKind } from "@throughline/contracts";
import { cn } from "@throughline/ui";
import { forwardRef, useId, useMemo } from "react";
import { CATEGORY, EDGE, groupStyle, roleIcon } from "./diagramStyle";
import { externalBrandIcon, vendorIcon } from "./icons";
import { groupDepth, pathData, type RoutedEdge, routeEdges, wrap } from "./routing";

type Props = {
  diagram: Diagram;
  /** Picks the vendor icon set. */
  cloud?: Cloud;
  zoom: number;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
};

const EDGE_KINDS = Object.keys(EDGE) as EdgeKind[];

function GroupBox({ g }: { g: DiagramGroup }) {
  const s = groupStyle(g);
  return (
    <g>
      <rect
        x={g.x}
        y={g.y}
        width={g.w}
        height={g.h}
        rx={g.kind === "subnet" ? 8 : 14}
        className={cn(s.fill, s.stroke)}
        strokeWidth={g.kind === "cloud" || g.kind === "network" ? 1.6 : 1.2}
        strokeDasharray={s.dash}
      />
      <text x={g.x + 14} y={g.y + 25} className={cn("text-caption font-semibold", s.label)}>
        {g.label}
        {g.cidr ? (
          <tspan className="fill-muted text-nano font-mono" dx={10}>
            {g.cidr}
          </tspan>
        ) : null}
      </text>
    </g>
  );
}

/** Small "i" badge: every component has an explanation one click away. */
export function InfoGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g aria-hidden className="pointer-events-none">
      <circle cx={x} cy={y} r={7} className="fill-surface-raised stroke-line-strong" strokeWidth={1} />
      <text x={x} y={y + 3.5} textAnchor="middle" className="fill-muted text-nano font-semibold">
        i
      </text>
    </g>
  );
}

function NodeBox({
  n,
  cloud,
  dim,
  active,
  onSelect,
  onHover,
}: {
  n: DiagramNode;
  cloud?: Cloud;
  dim: boolean;
  active: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const c = CATEGORY[n.category];
  const Icon = roleIcon(n.role);
  const brand = externalBrandIcon(n.category, `${n.label} ${n.tech ?? ""}`);
  const vendor = brand ?? vendorIcon(cloud, n.role);
  const big = n.h > 80;
  const tile = big ? 44 : 36;
  const textX = n.x + 16 + tile;
  const labelChars = Math.floor((n.w - tile - 44) / 6.8);
  const techChars = Math.floor((n.w - tile - 30) / 5.4);
  const label = wrap(n.label, labelChars, 2);
  const tech = n.tech ? wrap(n.tech, techChars, big ? 3 : label.length > 1 ? 1 : 2) : [];
  const blockH = label.length * 15 + tech.length * 13;
  const top = n.y + (n.h - blockH) / 2 + 11;
  return (
    // biome-ignore lint/a11y/useSemanticElements: SVG has no button element; this group is the interactive node
    <g
      role="button"
      tabIndex={0}
      aria-label={`${n.label}${n.tech ? `, ${n.tech}` : ""}`}
      aria-pressed={active}
      className={cn("cursor-pointer transition-opacity outline-none", dim && "opacity-30")}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(n.id);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(n.id);
        }
      }}
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(n.id)}
      onBlur={() => onHover(null)}
    >
      <title>{[n.label, n.tech, n.note].filter(Boolean).join(" · ")}</title>
      <rect
        x={n.x}
        y={n.y}
        width={n.w}
        height={n.h}
        rx={10}
        className={cn("fill-surface", active ? "stroke-strong" : c.stroke)}
        strokeWidth={active ? 2.4 : 1.4}
      />
      <rect
        x={n.x + 10}
        y={n.y + (n.h - tile) / 2}
        width={tile}
        height={tile}
        rx={n.category === "person" ? tile / 2 : 8}
        className={brand ? "fill-brand-tile" : vendor ? "fill-surface-raised" : c.soft}
      />
      {vendor ? (
        <image
          href={vendor}
          x={n.x + 10 + (tile - 24) / 2}
          y={n.y + (n.h - 24) / 2}
          width={24}
          height={24}
          aria-hidden
        />
      ) : (
        <Icon
          x={n.x + 10 + (tile - 20) / 2}
          y={n.y + (n.h - 20) / 2}
          width={20}
          height={20}
          className={c.color}
          aria-hidden
        />
      )}
      <InfoGlyph x={n.x + n.w - 11} y={n.y + 11} />
      <text className="fill-foreground text-caption font-semibold">
        {label.map((l, i) => (
          <tspan key={l} x={textX} y={top + i * 15}>
            {l}
          </tspan>
        ))}
      </text>
      {tech.length > 0 ? (
        <text className="fill-muted text-nano">
          {tech.map((l, i) => (
            <tspan key={l} x={textX} y={top + label.length * 15 + i * 13}>
              {l}
            </tspan>
          ))}
        </text>
      ) : null}
    </g>
  );
}

function EdgeLabel({ r, dim }: { r: RoutedEdge; dim: boolean }) {
  const text = r.edge.label ?? "";
  const control = r.edge.control;
  if (!text && !control) return null;
  const tw = text.length * 5.3 + (text ? 10 : 0);
  const cw = control ? control.length * 6 + 10 : 0;
  const total = tw + cw + (text && control ? 4 : 0);
  const x0 = r.label.x - total / 2;
  const y0 = r.label.y - 9;
  return (
    <g className={cn("pointer-events-none transition-opacity", dim && "opacity-15")}>
      {control ? (
        <>
          <rect
            x={x0}
            y={y0}
            width={cw}
            height={18}
            rx={9}
            className="fill-risk-soft stroke-risk"
            strokeWidth={1}
          />
          <text
            x={x0 + cw / 2}
            y={y0 + 12.5}
            textAnchor="middle"
            className="fill-risk-fg text-nano font-mono font-semibold"
          >
            {control}
          </text>
        </>
      ) : null}
      {text ? (
        <>
          <rect
            x={x0 + total - tw}
            y={y0}
            width={tw}
            height={18}
            rx={4}
            className="fill-background"
            opacity={0.92}
          />
          <text x={x0 + total - tw / 2} y={y0 + 12.5} textAnchor="middle" className="fill-subtle text-nano">
            {text}
          </text>
        </>
      ) : null}
    </g>
  );
}

/** Renders a laid-out box diagram (context, container, deployment, security) as SVG. */
export const DiagramCanvas = forwardRef<SVGSVGElement, Props>(function DiagramCanvas(
  { diagram, cloud, zoom, selected, hovered, onSelect, onHover },
  ref,
) {
  const uid = useId().replace(/:/g, "");
  const routed = useMemo(() => routeEdges(diagram), [diagram]);
  const groups = useMemo(() => {
    const depth = groupDepth(diagram);
    return [...diagram.groups].sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0));
  }, [diagram]);
  const focus = hovered ?? selected;
  const linked = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const r of routed) {
      if (r.edge.from === focus) set.add(r.edge.to);
      if (r.edge.to === focus) set.add(r.edge.from);
    }
    return set;
  }, [focus, routed]);
  const touches = (r: RoutedEdge) => !focus || r.edge.from === focus || r.edge.to === focus;

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      width={Math.round(diagram.width * zoom)}
      height={Math.round(diagram.height * zoom)}
      role="img"
      aria-labelledby={`${uid}-title`}
      className="block font-sans"
      onClick={() => onSelect(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onSelect(null);
      }}
    >
      <title id={`${uid}-title`}>{diagram.title}</title>
      <defs>
        {EDGE_KINDS.map((k) => (
          <marker
            key={k}
            id={`${uid}-arrow-${k}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" className={EDGE[k].marker} />
          </marker>
        ))}
      </defs>
      <rect width={diagram.width} height={diagram.height} className="fill-background" />
      {groups.map((g) => (
        <GroupBox key={g.id} g={g} />
      ))}
      {routed.map((r) => (
        <path
          key={r.edge.id}
          d={pathData(r.points)}
          fill="none"
          className={cn(EDGE[r.edge.kind].stroke, "transition-opacity", !touches(r) && "opacity-15")}
          strokeWidth={touches(r) && focus ? 2.2 : 1.5}
          strokeDasharray={EDGE[r.edge.kind].dash}
          markerEnd={`url(#${uid}-arrow-${r.edge.kind})`}
        />
      ))}
      {diagram.nodes.map((n) => (
        <NodeBox
          key={n.id}
          n={n}
          cloud={cloud}
          dim={Boolean(linked && !linked.has(n.id))}
          active={selected === n.id}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
      {routed.map((r) => (
        <EdgeLabel key={`${r.edge.id}-l`} r={r} dim={!touches(r)} />
      ))}
    </svg>
  );
});
