import { type ArchBrief, ArchitectureList, type Diagram } from "@throughline/contracts";
import { describe, expect, it } from "vitest";
import { acmeTenant } from "../seed/acme";
import { briefRisks } from "./document";
import { generateArchitecture, seedArchitecture } from "./index";
import { networkPlan } from "./network";
import {
  acmeMcpSubject,
  acmeSubject,
  emailListenerSubject,
  fabrikamSubject,
  northwindSubject,
} from "./subject";
import { suggestBrief } from "./suggest";

const base = suggestBrief(acmeTenant, acmeSubject).brief;

/** Layout and wiring problems in a diagram; empty when it is drawable. */
function problems(d: Diagram): string[] {
  const out: string[] = [];
  const ids = new Set([...d.nodes.map((n) => n.id), ...d.groups.map((g) => g.id)]);
  if (ids.size !== d.nodes.length + d.groups.length) out.push(`${d.id}: duplicate ids`);
  for (const e of d.edges)
    if (!ids.has(e.from) || !ids.has(e.to)) out.push(`${d.id}: edge ${e.from}→${e.to}`);
  const groups = new Map(d.groups.map((g) => [g.id, g]));
  for (const item of [...d.nodes, ...d.groups]) {
    if (item.x + item.w > d.width || item.y + item.h > d.height) out.push(`${d.id}: ${item.id} off canvas`);
    const parent = item.parent ? groups.get(item.parent) : undefined;
    if (item.parent && !parent) out.push(`${d.id}: ${item.id} missing parent`);
    if (
      parent &&
      !(
        item.x >= parent.x &&
        item.y >= parent.y &&
        item.x + item.w <= parent.x + parent.w &&
        item.y + item.h <= parent.y + parent.h
      )
    )
      out.push(`${d.id}: ${item.id} outside ${parent.id}`);
  }
  d.nodes.forEach((a, i) => {
    for (const b of d.nodes.slice(i + 1)) {
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        out.push(`${d.id}: ${a.id} overlaps ${b.id}`);
    }
  });
  return out;
}

const ipToInt = (ip: string) => ip.split(".").reduce((acc, o) => acc * 256 + Number(o), 0);
const range = (cidr: string) => {
  const [ip = "", bits = "32"] = cidr.split("/");
  const start = ipToInt(ip);
  return [start, start + 2 ** (32 - Number(bits)) - 1] as const;
};

/** Subjects the sweep rotates through; the MCP subject adds platform components and a custom flow. */
const SWEEP = [northwindSubject, fabrikamSubject, acmeMcpSubject, emailListenerSubject];

describe("architect agent", () => {
  it("suggests a brief from tenant settings and evidence, tagging how sure it is", () => {
    const { brief, suggestions } = suggestBrief(acmeTenant, acmeSubject);
    expect(brief.region).toBe("india");
    expect(suggestions.region?.basis).toBe("stated");
    expect(brief.keys).toBe("customer-managed");
    expect(brief.topology).toBe("hub-spoke");
    expect(suggestions.availability?.basis).toBe("assumed");
  });

  it("produces five diagrams and a full document for every seeded tenant", () => {
    for (const subject of [
      acmeSubject,
      acmeMcpSubject,
      emailListenerSubject,
      northwindSubject,
      fabrikamSubject,
    ]) {
      const record = seedArchitecture(acmeTenant, subject, true, { projectId: "prj-x" });
      expect(() => ArchitectureList.parse({ items: [record.architecture] })).not.toThrow();
      expect(record.architecture.diagrams.map((d) => d.kind)).toEqual([
        "context",
        "container",
        "deployment",
        "security",
        "sequence",
      ]);
      expect(record.architecture.diagrams.flatMap(problems)).toEqual([]);
      expect(record.architecture.document?.sections.length).toBeGreaterThanOrEqual(12);
    }
  });

  it("draws subject components and the subject's own key flow", () => {
    const mcp = suggestBrief(acmeTenant, acmeMcpSubject).brief;
    const out = generateArchitecture(mcp, acmeMcpSubject, 1);
    const ids = (kind: string) => out.diagrams.find((d) => d.kind === kind)?.nodes.map((x) => x.id) ?? [];
    for (const kind of ["container", "deployment", "security"])
      expect(ids(kind)).toEqual(expect.arrayContaining(["mcp-registry", "content-safety", "agent-id"]));
    expect(ids("security")).not.toContain("caller");
    const seq = out.diagrams.find((d) => d.kind === "sequence");
    expect(seq?.messages?.[0]?.label).toBe("POST /mcp · tools/call");
    expect(seq?.messages?.some((m) => m.to === "content-safety")).toBe(true);
    // Without a public edge the gateway takes the first hop.
    const internal = generateArchitecture({ ...mcp, exposure: "internal" }, acmeMcpSubject, 1);
    const first = internal.diagrams.find((d) => d.kind === "sequence")?.messages?.[0];
    expect([first?.from, first?.to]).toEqual(["actor", "entry"]);
    expect(out.document.sections.map((x) => x.title)).toContain("17. Platform status (checked 25 Oct 2026)");
  });

  it("is deterministic", () => {
    expect(generateArchitecture(base, acmeSubject, 2)).toEqual(generateArchitecture(base, acmeSubject, 2));
  });

  it("holds its layout and edge invariants across every combination of the main choices", () => {
    const clouds: ArchBrief["cloud"][] = ["azure", "aws", "gcp", "on-prem"];
    const computes: ArchBrief["compute"][] = ["kubernetes", "serverless-containers", "paas", "functions"];
    const messaging: ArchBrief["messaging"][] = ["none", "queue", "stream"];
    const exposure: ArchBrief["exposure"][] = ["public", "partner", "internal"];
    const connectivity: ArchBrief["connectivity"][] = ["none", "vpn", "private-circuit"];
    const topology: ArchBrief["topology"][] = ["hub-spoke", "single-network"];
    const availability: ArchBrief["availability"][] = ["single-zone", "multi-region-warm"];
    let count = 0;
    const found: string[] = [];
    for (const cloud of clouds)
      for (const compute of computes)
        for (const m of messaging)
          for (const x of exposure)
            for (const c of connectivity)
              for (const t of topology)
                for (const a of availability) {
                  const brief = {
                    ...base,
                    cloud,
                    compute,
                    messaging: m,
                    exposure: x,
                    connectivity: c,
                    topology: t,
                    availability: a,
                    ai: count % 3 === 0 ? ("managed" as const) : ("none" as const),
                    cache: count % 2 === 0 ? ("yes" as const) : ("no" as const),
                  };
                  const out = generateArchitecture(brief, SWEEP[count % SWEEP.length] ?? acmeSubject, 1);
                  found.push(
                    ...out.diagrams
                      .flatMap(problems)
                      .map((p) => `${cloud}/${compute}/${m}/${x}/${c}/${t}/${a}: ${p}`),
                  );
                  count++;
                }
    expect(found.slice(0, 5)).toEqual([]);
    expect(count).toBe(4 * 4 * 3 * 3 * 3 * 2 * 2);
  });

  it("plans address space without overlaps", () => {
    for (const cloud of ["azure", "aws", "gcp", "on-prem"] as const) {
      const plan = networkPlan({ ...base, cloud, connectivity: "private-circuit", topology: "hub-spoke" });
      const subnets = plan.subnets.map((s) => range(s.cidr));
      subnets.forEach((a, i) => {
        for (const b of subnets.slice(i + 1))
          expect(a[1] < b[0] || b[1] < a[0], `${cloud} overlap`).toBe(true);
      });
    }
  });

  it("flags answers that break residency or each other", () => {
    const risks = (b: Partial<ArchBrief>) => briefRisks({ ...base, ...b }, northwindSubject).map((r) => r[0]);
    expect(risks({ cloud: "gcp", region: "uae" }).some((r) => r?.includes("no region"))).toBe(true);
    expect(
      risks({ cloud: "aws", region: "uae", availability: "multi-region-warm" }).some((r) =>
        r?.includes("outside"),
      ),
    ).toBe(true);
    expect(
      risks({ classification: "restricted", keys: "platform" }).some((r) => r?.includes("provider-managed")),
    ).toBe(true);
  });
});
