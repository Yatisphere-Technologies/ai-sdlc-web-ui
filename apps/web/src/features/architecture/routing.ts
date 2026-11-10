import type { Diagram, DiagramEdge } from "@throughline/contracts";

export type Pt = { x: number; y: number };
export type Side = "left" | "right" | "top" | "bottom";
type Box = { x: number; y: number; w: number; h: number };

export type Port = { side: Side /** 0..1 along the side */; f: number; at: Pt };

export type RoutedEdge = {
  edge: DiagramEdge;
  exit: Port;
  entry: Port;
  /** Orthogonal polyline from exit to entry, including both ends. */
  points: Pt[];
  /** Where to put the label: middle of the longest segment. */
  label: Pt;
};

const OPPOSITE: Record<Side, Side> = { left: "right", right: "left", top: "bottom", bottom: "top" };

const centre = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const contains = (a: Box, b: Box) =>
  b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h;

function pickSide(a: Box, b: Box): Side {
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const ca = centre(a);
  const cb = centre(b);
  if (gapX >= gapY) return cb.x >= ca.x ? "right" : "left";
  return cb.y >= ca.y ? "bottom" : "top";
}

function portAt(b: Box, side: Side, f: number): Pt {
  switch (side) {
    case "left":
      return { x: b.x, y: b.y + b.h * f };
    case "right":
      return { x: b.x + b.w, y: b.y + b.h * f };
    case "top":
      return { x: b.x + b.w * f, y: b.y };
    default:
      return { x: b.x + b.w * f, y: b.y + b.h };
  }
}

function polyline(a: Pt, aSide: Side, b: Pt): Pt[] {
  const horizontal = aSide === "left" || aSide === "right";
  if (horizontal) {
    if (Math.abs(a.y - b.y) < 1) return [a, b];
    const mx = Math.round((a.x + b.x) / 2);
    return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b];
  }
  if (Math.abs(a.x - b.x) < 1) return [a, b];
  const my = Math.round((a.y + b.y) / 2);
  return [a, { x: a.x, y: my }, { x: b.x, y: my }, b];
}

function labelPoint(points: Pt[]): Pt {
  let best = { len: -1, at: points[0] ?? { x: 0, y: 0 } };
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    if (!p || !q) continue;
    const len = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
    if (len > best.len) best = { len, at: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 } };
  }
  return best.at;
}

/**
 * Orthogonal routing with ports spread along each side, so several lines leaving one box don't
 * sit on top of each other. Used by the in-app renderer and by the draw.io export (as exit/entry
 * constraints), so both pictures agree.
 */
export function routeEdges(d: Diagram): RoutedEdge[] {
  const boxes = new Map<string, Box>();
  for (const g of d.groups) boxes.set(g.id, g);
  for (const n of d.nodes) boxes.set(n.id, n);

  const plan = d.edges
    .map((edge) => {
      const a = boxes.get(edge.from);
      const b = boxes.get(edge.to);
      if (!a || !b || contains(a, b) || contains(b, a)) return null;
      const side = pickSide(a, b);
      return { edge, a, b, exitSide: side, entrySide: OPPOSITE[side] };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  // Spread ports: every (box, side) gets its edges ordered by where the other end is.
  const slots = new Map<string, { key: string; along: number }[]>();
  const slotKey = (id: string, side: Side) => `${id}:${side}`;
  const along = (side: Side, other: Box) =>
    side === "left" || side === "right" ? centre(other).y : centre(other).x;
  for (const p of plan) {
    const ek = slotKey(p.edge.from, p.exitSide);
    const nk = slotKey(p.edge.to, p.entrySide);
    slots.set(ek, [...(slots.get(ek) ?? []), { key: `${p.edge.id}:out`, along: along(p.exitSide, p.b) }]);
    slots.set(nk, [...(slots.get(nk) ?? []), { key: `${p.edge.id}:in`, along: along(p.entrySide, p.a) }]);
  }
  const fraction = new Map<string, number>();
  for (const list of slots.values()) {
    const sorted = [...list].sort((x, y) => x.along - y.along);
    sorted.forEach((s, i) => {
      fraction.set(s.key, Math.round(((i + 1) / (sorted.length + 1)) * 100) / 100);
    });
  }

  return plan.map((p) => {
    const fo = fraction.get(`${p.edge.id}:out`) ?? 0.5;
    const fi = fraction.get(`${p.edge.id}:in`) ?? 0.5;
    const exit: Port = { side: p.exitSide, f: fo, at: portAt(p.a, p.exitSide, fo) };
    const entry: Port = { side: p.entrySide, f: fi, at: portAt(p.b, p.entrySide, fi) };
    const points = polyline(exit.at, exit.side, entry.at);
    return { edge: p.edge, exit, entry, points, label: labelPoint(points) };
  });
}

/** SVG path data for a routed polyline. */
export const pathData = (points: Pt[]) =>
  points.map((p, i) => `${i === 0 ? "M" : "L"}${Math.round(p.x)},${Math.round(p.y)}`).join(" ");

/** Depth of each group so parents paint before children. */
export function groupDepth(d: Diagram): Map<string, number> {
  const parent = new Map(d.groups.map((g) => [g.id, g.parent]));
  const depth = new Map<string, number>();
  for (const g of d.groups) {
    let n = 0;
    let p = g.parent;
    while (p && n < 20) {
      n++;
      p = parent.get(p);
    }
    depth.set(g.id, n);
  }
  return depth;
}

/** Splits text into at most `max` lines of roughly `width` characters, adding an ellipsis if cut. */
export function wrap(text: string, width: number, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > width && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${(kept[max - 1] ?? "").slice(0, Math.max(0, width - 1)).trimEnd()}…`;
  return kept;
}
