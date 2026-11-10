import type { Architecture, Cloud, Diagram, DiagramGroup, DiagramNode } from "@throughline/contracts";
import { routeEdges } from "../routing";
import SHAPES from "./drawioShapes.json";
import THEME from "./drawioTheme.json";

/**
 * Exports an architecture as a multi-page .drawio file (mxGraph XML). Each diagram is a page; nodes
 * are cards carrying the real vendor icon (Azure, AWS or Google Cloud shape libraries), groups are
 * containers so children move with them, and edges keep the same ports as the in-app view.
 *
 * Opens in draw.io / diagrams.net (desktop, web, VS Code, Confluence, Jira). From draw.io, File →
 * Export as → VSDX gives a Visio file; Lucidchart imports .drawio directly.
 */

type ShapeSet = Record<string, string>;
const shapes = SHAPES as unknown as Record<"azure" | "aws" | "gcp" | "generic", ShapeSet>;

const TITLE_SPACE = 64;

export const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const style = (o: Record<string, string | number | undefined | false>) =>
  `${Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== false)
    .map(([k, v]) => (v === "" ? k : `${k}=${v}`))
    .join(";")};`;

/** Picks the vendor icon for a node, falling back to neutral shapes for people and on-prem systems. */
export function iconStyle(cloud: Cloud, n: Pick<DiagramNode, "role" | "category">): string | null {
  const vendor = cloud === "on-prem" ? undefined : shapes[cloud]?.[n.role];
  if (vendor) return vendor;
  const g = shapes.generic;
  if (g[n.role]) return g[n.role] ?? null;
  if (n.category === "person") return g.users ?? null;
  if (n.category === "data") return g.database ?? null;
  if (n.category === "external") return g.external ?? null;
  return g.server ?? null;
}

function groupCellStyle(cloud: Cloud, gr: DiagramGroup): string {
  const base = THEME.group[gr.kind];
  const vendor = THEME.cloudGroup[cloud] as Record<string, string>;
  const trust = gr.trust ? THEME.trust[gr.trust] : undefined;
  const stroke = trust?.stroke ?? vendor[gr.kind] ?? base.stroke;
  const fill = trust?.fill ?? base.fill;
  return style({
    rounded: 1,
    arcSize: gr.kind === "subnet" ? 4 : 3,
    absoluteArcSize: 1,
    whiteSpace: "wrap",
    html: 1,
    container: 1,
    collapsible: 0,
    recursiveResize: 0,
    pointerEvents: 0,
    fillColor: fill,
    strokeColor: stroke,
    strokeWidth: gr.kind === "cloud" || gr.kind === "network" ? 2 : 1,
    dashed: base.dashed || trust ? 1 : 0,
    verticalAlign: "top",
    align: "left",
    spacingLeft: gr.kind === "network" || gr.kind === "subnet" ? 34 : 12,
    spacingTop: 6,
    fontColor: trust?.stroke ?? (vendor[gr.kind] ? stroke : base.font),
    fontStyle: 1,
    fontSize: 12,
    fontFamily: THEME.font,
  });
}

function cardStyle(n: DiagramNode): string {
  const color = THEME.category[n.category];
  return style({
    rounded: 1,
    arcSize: 10,
    whiteSpace: "wrap",
    html: 1,
    fillColor: THEME.card,
    strokeColor: color,
    strokeWidth: 1.5,
    align: "left",
    verticalAlign: "middle",
    spacingLeft: 60,
    spacingRight: 6,
    fontColor: THEME.text,
    fontSize: 12,
    fontFamily: THEME.font,
    container: 1,
    collapsible: 0,
  });
}

const cardLabel = (n: DiagramNode) =>
  esc(
    `<b>${esc(n.label)}</b>${n.tech ? `<br><span style="font-size:10px;color:${THEME.muted}">${esc(n.tech)}</span>` : ""}`,
  );

type Cell = string;

function boxPage(cloud: Cloud, d: Diagram): Cell[] {
  const cells: Cell[] = [];
  const groups = new Map(d.groups.map((g) => [g.id, g]));
  /** Child coordinates are relative to their container; top-level ones sit below the title. */
  const at = (item: { x: number; y: number; parent?: string }) => {
    const p = item.parent ? groups.get(item.parent) : undefined;
    return p ? { x: item.x - p.x, y: item.y - p.y } : { x: item.x, y: item.y + TITLE_SPACE };
  };
  const parentId = (parent?: string) => (parent && groups.has(parent) ? `g-${parent}` : "1");

  // Parents must be declared before children.
  const depth = (g: DiagramGroup): number =>
    g.parent && groups.get(g.parent) ? 1 + depth(groups.get(g.parent) as DiagramGroup) : 0;
  const sorted = [...d.groups].sort((a, b) => depth(a) - depth(b));
  for (const g of sorted) {
    const o = at(g);
    const label = g.cidr
      ? `${esc(g.label)}  <font style="font-weight:normal" color="${THEME.muted}">${esc(g.cidr)}</font>`
      : esc(g.label);
    cells.push(
      `<mxCell id="g-${esc(g.id)}" value="${esc(label)}" style="${groupCellStyle(cloud, g)}" vertex="1" parent="${parentId(g.parent)}"><mxGeometry x="${o.x}" y="${o.y}" width="${g.w}" height="${g.h}" as="geometry"/></mxCell>`,
    );
    const icon =
      g.kind === "network"
        ? shapes[cloud === "on-prem" ? "generic" : cloud]?.network
        : g.kind === "subnet" && cloud === "azure"
          ? shapes.azure.subnet
          : undefined;
    if (icon) {
      cells.push(
        `<mxCell id="gi-${esc(g.id)}" value="" style="${esc(icon)}" vertex="1" parent="g-${esc(g.id)}"><mxGeometry x="8" y="6" width="22" height="22" as="geometry"/></mxCell>`,
      );
    }
  }
  for (const n of d.nodes) {
    const o = at(n);
    cells.push(
      `<mxCell id="n-${esc(n.id)}" value="${cardLabel(n)}" style="${cardStyle(n)}" vertex="1" parent="${parentId(n.parent)}"><mxGeometry x="${o.x}" y="${o.y}" width="${n.w}" height="${n.h}" as="geometry"/></mxCell>`,
    );
    const icon = iconStyle(cloud, n);
    if (icon) {
      const size = 40;
      cells.push(
        `<mxCell id="ni-${esc(n.id)}" value="" style="${esc(icon)}" vertex="1" parent="n-${esc(n.id)}"><mxGeometry x="10" y="${(n.h - size) / 2}" width="${size}" height="${size}" as="geometry"/></mxCell>`,
      );
    }
  }
  for (const r of routeEdges(d)) {
    const e = r.edge;
    const k = THEME.edge[e.kind] as { color: string; dash?: string };
    const isGroup = (id: string) => groups.has(id);
    const src = `${isGroup(e.from) ? "g" : "n"}-${esc(e.from)}`;
    const tgt = `${isGroup(e.to) ? "g" : "n"}-${esc(e.to)}`;
    const fx = (s: string, f: number) => (s === "left" ? 0 : s === "right" ? 1 : f);
    const fy = (s: string, f: number) => (s === "top" ? 0 : s === "bottom" ? 1 : f);
    const label = [
      e.control ? `<b style="color:${THEME.control.color}">${esc(e.control)}</b>` : "",
      e.label ? esc(e.label) : "",
    ]
      .filter(Boolean)
      .join(" ");
    const st = style({
      edgeStyle: "orthogonalEdgeStyle",
      rounded: 1,
      html: 1,
      endArrow: "block",
      endFill: 1,
      endSize: 6,
      strokeColor: k.color,
      strokeWidth: 1.5,
      dashed: k.dash ? 1 : 0,
      dashPattern: k.dash,
      exitX: fx(r.exit.side, r.exit.f),
      exitY: fy(r.exit.side, r.exit.f),
      exitDx: 0,
      exitDy: 0,
      entryX: fx(r.entry.side, r.entry.f),
      entryY: fy(r.entry.side, r.entry.f),
      entryDx: 0,
      entryDy: 0,
      fontSize: 10,
      fontColor: THEME.text,
      fontFamily: THEME.font,
      labelBackgroundColor: THEME.card,
    });
    const mids = r.points
      .slice(1, -1)
      .map((p) => `<mxPoint x="${p.x}" y="${p.y + TITLE_SPACE}"/>`)
      .join("");
    cells.push(
      `<mxCell id="e-${esc(e.id)}" value="${esc(label)}" style="${st}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry">${mids ? `<Array as="points">${mids}</Array>` : ""}</mxGeometry></mxCell>`,
    );
  }
  return cells;
}

function sequencePage(cloud: Cloud, d: Diagram): Cell[] {
  const cells: Cell[] = [];
  const messages = d.messages ?? [];
  const height = 120 + messages.length * 46 + 20 - 24;
  const cx = new Map(d.nodes.map((n) => [n.id, n.x + n.w / 2]));
  for (const n of d.nodes) {
    const st = style({
      shape: "umlLifeline",
      perimeter: "lifelinePerimeter",
      whiteSpace: "wrap",
      html: 1,
      container: 1,
      dropTarget: 0,
      collapsible: 0,
      recursiveResize: 0,
      outlineConnect: 0,
      portConstraint: "eastwest",
      size: n.h,
      fillColor: THEME.card,
      strokeColor: THEME.category[n.category],
      fontColor: THEME.text,
      fontFamily: THEME.font,
      fontSize: 12,
      spacingLeft: 24,
    });
    cells.push(
      `<mxCell id="n-${esc(n.id)}" value="${cardLabel(n)}" style="${st}" vertex="1" parent="1"><mxGeometry x="${n.x}" y="${n.y + TITLE_SPACE}" width="${n.w}" height="${height}" as="geometry"/></mxCell>`,
    );
    const icon = iconStyle(cloud, n);
    if (icon)
      cells.push(
        `<mxCell id="ni-${esc(n.id)}" value="" style="${esc(icon)}" vertex="1" parent="n-${esc(n.id)}"><mxGeometry x="6" y="6" width="20" height="20" as="geometry"/></mxCell>`,
      );
  }
  messages.forEach((m, i) => {
    const y = 120 + i * 46 + TITLE_SPACE;
    const k = THEME.edge[m.kind] as { color: string; dash?: string };
    const st = style({
      html: 1,
      verticalAlign: "bottom",
      endArrow: m.reply ? "open" : "block",
      endFill: m.reply ? 0 : 1,
      strokeColor: m.reply ? THEME.muted : k.color,
      dashed: m.reply || k.dash ? 1 : 0,
      fontSize: 11,
      fontColor: THEME.text,
      fontFamily: THEME.font,
      labelBackgroundColor: THEME.card,
    });
    const label = `${m.step}. ${m.label}`;
    cells.push(
      `<mxCell id="m-${m.step}" value="${esc(label)}" style="${st}" edge="1" parent="1"><mxGeometry relative="1" as="geometry"><mxPoint x="${cx.get(m.from) ?? 0}" y="${y}" as="sourcePoint"/><mxPoint x="${cx.get(m.to) ?? 0}" y="${y}" as="targetPoint"/></mxGeometry></mxCell>`,
    );
  });
  return cells;
}

function page(arch: Architecture, d: Diagram, index: number): string {
  const cloud = arch.brief.cloud;
  const cells = d.kind === "sequence" ? sequencePage(cloud, d) : boxPage(cloud, d);
  const title = style({
    text: "",
    html: 1,
    align: "left",
    verticalAlign: "top",
    fontSize: 18,
    fontStyle: 1,
    fontColor: THEME.text,
    fontFamily: THEME.font,
    whiteSpace: "wrap",
  });
  const caption = style({
    text: "",
    html: 1,
    align: "left",
    verticalAlign: "top",
    fontSize: 11,
    fontColor: THEME.muted,
    fontFamily: THEME.font,
    whiteSpace: "wrap",
  });
  const header = [
    `<mxCell id="title" value="${esc(d.title)}" style="${title}" vertex="1" parent="1"><mxGeometry x="24" y="8" width="${Math.max(400, d.width - 48)}" height="26" as="geometry"/></mxCell>`,
    `<mxCell id="caption" value="${esc(`${d.caption} · ${arch.workItemKey} · revision ${arch.revision}`)}" style="${caption}" vertex="1" parent="1"><mxGeometry x="24" y="34" width="${Math.max(400, d.width - 48)}" height="22" as="geometry"/></mxCell>`,
  ];
  return [
    `<diagram id="${esc(d.id)}-${index}" name="${esc(`${index + 1} ${d.title.split(" · ").pop() ?? d.kind}`)}">`,
    `<mxGraphModel dx="${d.width}" dy="${d.height}" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${d.width}" pageHeight="${d.height + TITLE_SPACE}" math="0" shadow="0" background="${THEME.card}">`,
    `<root><mxCell id="0"/><mxCell id="1" parent="0"/>${header.join("")}${cells.join("")}</root>`,
    "</mxGraphModel></diagram>",
  ].join("");
}

export function toDrawio(arch: Architecture, diagrams: Diagram[] = arch.diagrams): string {
  const pages = diagrams.map((d, i) => page(arch, d, i)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="Throughline" agent="architect-agent" version="24.7.17" type="device">${pages}</mxfile>\n`;
}
