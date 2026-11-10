import { describe, expect, it } from "vitest";
import { seedArchitecture } from "@/mocks/architect";
import {
  acmeMcpSubject,
  acmeSubject,
  emailListenerSubject,
  fabrikamSubject,
  northwindSubject,
} from "@/mocks/architect/subject";
import { acmeTenant } from "@/mocks/seed/acme";
import { fabrikamTenant } from "@/mocks/seed/fabrikam";
import { northwindTenant } from "@/mocks/seed/northwind";
import { toDrawio } from "./drawio";
import { toMarkdown } from "./markdown";

const archs = [
  seedArchitecture(acmeTenant, acmeSubject, true, { projectId: "prj-upi" }).architecture,
  seedArchitecture(acmeTenant, acmeMcpSubject, true, { projectId: "prj-mcp" }).architecture,
  seedArchitecture(acmeTenant, emailListenerSubject, true, { projectId: "prj-sup" }).architecture,
  seedArchitecture(northwindTenant, northwindSubject, true, { projectId: "prj-iso" }).architecture,
  seedArchitecture(fabrikamTenant, fabrikamSubject, true, { projectId: "prj-loy" }).architecture,
];

describe("draw.io export", () => {
  it("writes well-formed mxGraph XML with one page per diagram and no dangling references", () => {
    for (const arch of archs) {
      const xml = toDrawio(arch);
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
      const pages = Array.from(doc.getElementsByTagName("diagram"));
      expect(pages).toHaveLength(arch.diagrams.length);
      for (const p of pages) {
        const cells = Array.from(p.getElementsByTagName("mxCell"));
        const ids = new Set(cells.map((c) => c.getAttribute("id")));
        expect(ids.size, "unique ids").toBe(cells.length);
        for (const c of cells) {
          const parent = c.getAttribute("parent");
          if (parent) expect(ids.has(parent), `parent ${parent}`).toBe(true);
          for (const ref of ["source", "target"]) {
            const v = c.getAttribute(ref);
            if (v) expect(ids.has(v), `${ref} ${v}`).toBe(true);
          }
        }
      }
    }
  });

  it("uses the real vendor shape library for the chosen cloud", () => {
    const [azure, , , , aws] = archs;
    expect(azure && toDrawio(azure)).toContain("img/lib/azure2/containers/Kubernetes_Services.svg");
    expect(aws && toDrawio(aws)).toContain("resIcon=mxgraph.aws4.fargate");
    expect(aws && toDrawio(aws)).toContain("resIcon=mxgraph.aws4.dynamodb");
  });

  it("escapes labels so ampersands and angle brackets can't break the file", () => {
    const arch = archs[0];
    if (!arch) throw new Error("seed");
    const d = arch.diagrams[0];
    if (!d) throw new Error("diagram");
    const tricky = { ...d, nodes: d.nodes.map((n, i) => (i === 0 ? { ...n, label: `A & <B> "C"` } : n)) };
    const xml = toDrawio(arch, [tricky]);
    expect(
      new DOMParser().parseFromString(xml, "application/xml").getElementsByTagName("parsererror"),
    ).toHaveLength(0);
  });
});

describe("markdown export", () => {
  it("includes every section, the decisions with pros and cons, and diagram references", () => {
    const arch = archs[0];
    if (!arch) throw new Error("seed");
    const md = toMarkdown(arch, "mandate-platform");
    for (const s of arch.document?.sections ?? []) expect(md).toContain(`## ${s.title}`);
    expect(md).toContain("### AD-01");
    expect(md).toContain("✅ chosen");
    expect(md).toContain("./mandate-platform-deployment.svg");
  });
});
