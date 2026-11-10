import type { Cloud, Diagram } from "@throughline/contracts";
import { cn } from "@throughline/ui";
import { forwardRef, useId } from "react";
import { InfoGlyph } from "./DiagramCanvas";
import { CATEGORY, EDGE, roleIcon } from "./diagramStyle";
import { externalBrandIcon, vendorIcon } from "./icons";
import { wrap } from "./routing";

export const SEQ = { top: 120, step: 46 } as const;

/** Sequence diagram: participants across the top, numbered messages down the lifelines. */
export const SequenceCanvas = forwardRef<
  SVGSVGElement,
  {
    diagram: Diagram;
    cloud?: Cloud;
    zoom: number;
    selected: string | null;
    onSelect: (id: string | null) => void;
  }
>(function SequenceCanvas({ diagram, cloud, zoom, selected, onSelect }, ref) {
  const uid = useId().replace(/:/g, "");
  const x = new Map(diagram.nodes.map((n) => [n.id, n.x + n.w / 2]));
  const messages = diagram.messages ?? [];
  const bottom = SEQ.top + messages.length * SEQ.step;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${diagram.width} ${diagram.height}`}
      width={Math.round(diagram.width * zoom)}
      height={Math.round(diagram.height * zoom)}
      role="img"
      aria-labelledby={`${uid}-t`}
      className="block font-sans"
    >
      <title id={`${uid}-t`}>{diagram.title}</title>
      <defs>
        {(["solid", "reply"] as const).map((k) => (
          <marker
            key={k}
            id={`${uid}-${k}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" className={k === "reply" ? "fill-muted" : "fill-subtle"} />
          </marker>
        ))}
      </defs>
      <rect width={diagram.width} height={diagram.height} className="fill-background" />
      {diagram.nodes.map((n) => {
        const c = CATEGORY[n.category];
        const Icon = roleIcon(n.role);
        const brand = externalBrandIcon(n.category, `${n.label} ${n.tech ?? ""}`);
        const vendor = brand ?? vendorIcon(cloud, n.role);
        const cx = n.x + n.w / 2;
        const active = selected === n.id;
        return (
          // biome-ignore lint/a11y/useSemanticElements: SVG has no button element
          <g
            key={n.id}
            role="button"
            tabIndex={0}
            aria-label={n.label}
            aria-pressed={active}
            className="cursor-pointer outline-none"
            onClick={() => onSelect(active ? null : n.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect(active ? null : n.id);
            }}
          >
            <line
              x1={cx}
              x2={cx}
              y1={n.y + n.h}
              y2={bottom + 10}
              className="stroke-line-strong"
              strokeDasharray="4 4"
            />
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              rx={10}
              className={cn("fill-surface", active ? "stroke-strong" : c.stroke)}
              strokeWidth={active ? 2.2 : 1.4}
            />
            {brand ? (
              <rect x={n.x + 7} y={n.y + 7} width={22} height={22} rx={5} className="fill-brand-tile" />
            ) : null}
            {vendor ? (
              <image href={vendor} x={n.x + 9} y={n.y + 9} width={18} height={18} aria-hidden />
            ) : (
              <Icon x={n.x + 10} y={n.y + 10} width={16} height={16} className={c.color} aria-hidden />
            )}
            <InfoGlyph x={n.x + n.w - 11} y={n.y + 11} />
            <text className="fill-foreground text-caption font-semibold">
              {wrap(n.label, 16, 2).map((l, i) => (
                <tspan key={l} x={n.x + 32} y={n.y + 22 + i * 14}>
                  {l}
                </tspan>
              ))}
            </text>
            {n.tech ? (
              <text x={n.x + 10} y={n.y + n.h - 8} className="fill-muted text-nano">
                {wrap(n.tech, 28, 1)[0]}
              </text>
            ) : null}
          </g>
        );
      })}
      {messages.map((m, i) => {
        const x1 = x.get(m.from) ?? 0;
        const x2 = x.get(m.to) ?? 0;
        const y = SEQ.top + i * SEQ.step;
        const left = Math.min(x1, x2);
        const dim = selected !== null && m.from !== selected && m.to !== selected;
        const dir = x2 >= x1 ? 1 : -1;
        return (
          <g key={m.step} className={cn("transition-opacity", dim && "opacity-20")}>
            <title>{m.note ? `${m.label} · ${m.note}` : m.label}</title>
            <line
              x1={x1 + dir * 2}
              x2={x2 - dir * 4}
              y1={y}
              y2={y}
              className={m.reply ? "stroke-muted" : EDGE[m.kind].stroke}
              strokeWidth={1.5}
              strokeDasharray={m.reply ? "5 4" : EDGE[m.kind].dash}
              markerEnd={`url(#${uid}-${m.reply ? "reply" : "solid"})`}
            />
            <circle
              cx={left + 14}
              cy={y - 12}
              r={9}
              className="fill-agent-soft stroke-agent"
              strokeWidth={1}
            />
            <text
              x={left + 14}
              y={y - 8.5}
              textAnchor="middle"
              className="fill-agent-fg text-nano font-mono font-semibold"
            >
              {m.step}
            </text>
            <text
              x={left + 28}
              y={y - 8}
              className={cn("text-micro", m.reply ? "fill-muted" : "fill-foreground")}
            >
              {m.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
});
