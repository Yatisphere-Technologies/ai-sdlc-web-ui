import type { Diagram } from "@throughline/contracts";
import { describe, expect, it } from "vitest";
import { groupDepth, routeEdges, wrap } from "./routing";

const node = (id: string, x: number, y: number) => ({
  id,
  label: id,
  role: "system",
  category: "system" as const,
  x,
  y,
  w: 100,
  h: 50,
});

const diagram = (edges: Diagram["edges"]): Diagram => ({
  id: "d",
  kind: "container",
  title: "t",
  caption: "c",
  width: 800,
  height: 600,
  groups: [
    { id: "g1", label: "outer", kind: "region", x: 0, y: 0, w: 800, h: 600 },
    { id: "g2", label: "inner", kind: "subnet", x: 10, y: 10, w: 300, h: 300, parent: "g1" },
  ],
  nodes: [node("a", 20, 20), node("b", 400, 20), node("c", 400, 200), node("d", 20, 400)],
  edges,
});

describe("routeEdges", () => {
  it("leaves from the side facing the other box and enters on the opposite side", () => {
    const [r] = routeEdges(diagram([{ id: "e1", from: "a", to: "b", kind: "request" }]));
    expect(r?.exit.side).toBe("right");
    expect(r?.entry.side).toBe("left");
    expect(r?.points[0]).toEqual({ x: 120, y: 45 });
  });

  it("goes vertical when boxes are stacked", () => {
    const [r] = routeEdges(diagram([{ id: "e1", from: "a", to: "d", kind: "request" }]));
    expect(r?.exit.side).toBe("bottom");
    expect(r?.entry.side).toBe("top");
  });

  it("spreads several edges leaving one side so they don't overlap", () => {
    const routed = routeEdges(
      diagram([
        { id: "e1", from: "a", to: "b", kind: "request" },
        { id: "e2", from: "a", to: "c", kind: "data" },
      ]),
    );
    const fs = routed.map((r) => r.exit.f);
    expect(new Set(fs).size).toBe(2);
    routed.forEach((r) => {
      r.points.slice(1).forEach((p, i) => {
        const prev = r.points[i];
        expect(prev && (prev.x === p.x || prev.y === p.y)).toBe(true);
      });
    });
  });

  it("skips edges between a group and something it contains", () => {
    expect(routeEdges(diagram([{ id: "e1", from: "g2", to: "a", kind: "admin" }]))).toHaveLength(0);
  });
});

describe("helpers", () => {
  it("orders groups by depth", () => {
    expect(groupDepth(diagram([])).get("g2")).toBe(1);
  });
  it("wraps and truncates", () => {
    expect(wrap("Azure Database for PostgreSQL Flexible Server", 16, 2)).toEqual([
      "Azure Database",
      "for PostgreSQL…",
    ]);
  });
});
