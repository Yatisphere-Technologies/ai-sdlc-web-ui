import type { DiagramCategory, DiagramGroup, DiagramNode } from "@throughline/contracts";
import type { ServiceRole } from "./catalog";

/**
 * A small box layout for architecture diagrams. Diagrams are described as nested groups (cloud →
 * region → network → subnet) holding service nodes on a grid; this computes absolute positions so
 * the in-app renderer and the draw.io export draw exactly the same picture.
 */
export type LNode = {
  t: "n";
  id: string;
  label: string;
  tech?: string;
  role: ServiceRole;
  category: DiagramCategory;
  note?: string;
  w?: number;
  h?: number;
};

export type LGroup = {
  t: "g";
  id: string;
  label: string;
  kind: DiagramGroup["kind"];
  cidr?: string;
  trust?: DiagramGroup["trust"];
  /** Children per row. Defaults to all in one row; use 1 for a column. */
  cols?: number;
  /** Stretch child groups to fill their grid cell so siblings line up. */
  stretch?: boolean;
  /** Draw this group. The root is usually invisible. */
  hidden?: boolean;
  children: LItem[];
};

export type LItem = LNode | LGroup;

export const NODE_W = 200;
export const NODE_H = 64;
const GAP = 28;
const PAD = 20;
const HEAD = 42;
const MARGIN = 24;

type Size = { w: number; h: number };

const visible = (items: LItem[]) => items.filter((i) => i.t === "n" || i.children.length > 0);

function grid(g: LGroup, sizes: Map<LItem, Size>) {
  const kids = visible(g.children);
  const cols = Math.max(1, Math.min(g.cols ?? kids.length, kids.length));
  const rows = Math.ceil(kids.length / cols);
  const colW = Array.from({ length: cols }, () => 0);
  const rowH = Array.from({ length: rows }, () => 0);
  kids.forEach((k, i) => {
    const s = sizes.get(k) ?? { w: 0, h: 0 };
    const c = i % cols;
    const r = Math.floor(i / cols);
    colW[c] = Math.max(colW[c] ?? 0, s.w);
    rowH[r] = Math.max(rowH[r] ?? 0, s.h);
  });
  return { kids, cols, colW, rowH };
}

function measure(item: LItem, sizes: Map<LItem, Size>): Size {
  if (item.t === "n") {
    const s = { w: item.w ?? NODE_W, h: item.h ?? NODE_H };
    sizes.set(item, s);
    return s;
  }
  for (const k of visible(item.children)) measure(k, sizes);
  const { colW, rowH } = grid(item, sizes);
  const innerW = colW.reduce((a, b) => a + b, 0) + GAP * Math.max(0, colW.length - 1);
  const innerH = rowH.reduce((a, b) => a + b, 0) + GAP * Math.max(0, rowH.length - 1);
  const pad = item.hidden ? 0 : PAD;
  const head = item.hidden ? 0 : HEAD;
  const labelW = item.label.length * 7.5 + (item.cidr ? item.cidr.length * 7 + 24 : 0) + 2 * PAD;
  const s = { w: Math.max(innerW + 2 * pad, item.hidden ? 0 : labelW), h: innerH + head + pad };
  sizes.set(item, s);
  return s;
}

export type Laid = { width: number; height: number; groups: DiagramGroup[]; nodes: DiagramNode[] };

export function layout(root: LGroup): Laid {
  const sizes = new Map<LItem, Size>();
  const total = measure(root, sizes);
  const groups: DiagramGroup[] = [];
  const nodes: DiagramNode[] = [];

  const place = (item: LItem, x: number, y: number, size: Size, parent?: string) => {
    if (item.t === "n") {
      nodes.push({
        id: item.id,
        label: item.label,
        tech: item.tech,
        role: item.role,
        category: item.category,
        note: item.note,
        x: Math.round(x),
        y: Math.round(y),
        w: size.w,
        h: size.h,
        parent,
      });
      return;
    }
    const own = item.hidden ? parent : item.id;
    if (!item.hidden) {
      groups.push({
        id: item.id,
        label: item.label,
        kind: item.kind,
        cidr: item.cidr,
        trust: item.trust,
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(size.w),
        h: Math.round(size.h),
        parent,
      });
    }
    const natural = sizes.get(item) ?? size;
    const pad = item.hidden ? 0 : PAD;
    const head = item.hidden ? 0 : HEAD;
    const { kids, cols, colW, rowH } = grid(item, sizes);
    const offsetX = (size.w - natural.w) / 2;
    let cy = y + head;
    for (let r = 0; r < rowH.length; r++) {
      let cx = x + pad + offsetX;
      for (let c = 0; c < cols; c++) {
        const kid = kids[r * cols + c];
        const cw = colW[c] ?? 0;
        const rh = rowH[r] ?? 0;
        if (kid) {
          const ks = sizes.get(kid) ?? { w: 0, h: 0 };
          const stretch = item.stretch && kid.t === "g";
          const s = stretch ? { w: cw, h: rh } : ks;
          place(kid, cx + (cw - s.w) / 2, cy + (rh - s.h) / 2, s, own);
        }
        cx += cw + GAP;
      }
      cy += (rowH[r] ?? 0) + GAP;
    }
  };

  place(root, MARGIN, MARGIN, total);
  return { width: Math.round(total.w + 2 * MARGIN), height: Math.round(total.h + 2 * MARGIN), groups, nodes };
}

export const n = (
  id: string,
  label: string,
  role: ServiceRole,
  category: DiagramCategory,
  tech?: string,
  extra: Partial<LNode> = {},
): LNode => ({ t: "n", id, label, role, category, tech, ...extra });

export const g = (
  id: string,
  label: string,
  kind: DiagramGroup["kind"],
  children: (LItem | null | false)[],
  extra: Partial<Omit<LGroup, "t" | "children">> = {},
): LGroup => ({
  t: "g",
  id,
  label,
  kind,
  children: children.filter((c): c is LItem => Boolean(c)),
  ...extra,
});
