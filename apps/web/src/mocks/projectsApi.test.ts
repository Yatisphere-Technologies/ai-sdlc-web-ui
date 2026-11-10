import {
  ArchitectureList,
  BrdList,
  ChoiceImpact,
  checkBrd,
  Portfolio,
  ProjectOverview,
  StudioState,
  WorkItemList,
} from "@throughline/contracts";
import { createTenantApi } from "@/api/http";
import { resetDb, setSignedIn } from "./db";
import { mockServer } from "./node";
import { integrityProblems } from "./projects";
import { acmeSeed } from "./seed/acme";
import { fabrikamSeed } from "./seed/fabrikam";
import { northwindSeed } from "./seed/northwind";

const BASE = window.location.origin;
let realFetch: typeof fetch;

beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: "error" });
  realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    realFetch(typeof input === "string" && input.startsWith("/") ? `${BASE}${input}` : input, init);
});
beforeEach(() => setSignedIn(true));
afterEach(() => resetDb());
afterAll(() => {
  mockServer.close();
  globalThis.fetch = realFetch;
});

const acme = () => createTenantApi("t_acme7f");
const northwind = () => createTenantApi("t_nwb21c");
const fabrikam = () => createTenantApi("t_fab4d0");
const project = (api: ReturnType<typeof createTenantApi>, key: string) =>
  api.get(`/projects/${key}`, ProjectOverview);

describe("seed integrity", () => {
  it("leaves nothing orphaned in any tenant: every item belongs to a project, every link resolves", () => {
    for (const seed of [acmeSeed, northwindSeed, fabrikamSeed]) expect(integrityProblems(seed)).toEqual([]);
  });

  it("only has approved BRDs that pass the quality checks", () => {
    for (const seed of [acmeSeed, northwindSeed, fabrikamSeed])
      for (const r of seed.brds.filter((x) => x.brd.status === "approved"))
        expect(
          checkBrd(r.brd.content).filter((c) => c.severity === "error"),
          r.brd.id,
        ).toEqual([]);
  });

  it("gives every architecture node a component that explains it", () => {
    for (const seed of [acmeSeed, northwindSeed, fabrikamSeed])
      for (const { architecture: a } of seed.architectures) {
        const ids = new Set(a.components.map((c) => c.id));
        for (const d of a.diagrams)
          for (const n of d.nodes) expect(ids.has(n.component ?? ""), `${a.id} ${d.kind} ${n.id}`).toBe(true);
      }
  });
});

describe("programs and projects API", () => {
  it("lists programs with their projects, health and cross-project dependencies", async () => {
    const p = await acme().get("/portfolio", Portfolio);
    expect(p.programs.map((x) => x.key)).toEqual(["PAY", "RISK", "AIOPS"]);
    expect(p.projects).toHaveLength(6);
    const sup = p.projects.find((x) => x.key === "SUP");
    expect(sup?.dependsOn).toEqual(["MCP"]);
    expect(p.projects.find((x) => x.key === "MCP")?.platform).toBe(true);
  });

  it("shows a project with its artifacts, links, plan and lifecycle", async () => {
    const o = await project(acme(), "SUP");
    expect(o.program.key).toBe("AIOPS");
    const keys = o.artifacts.map((a) => a.ref.id);
    expect(keys).toEqual(expect.arrayContaining(["BRD-40", "bl-BRD-40", "arch-40", "plan-sup"]));
    expect(o.related).toEqual([expect.objectContaining({ key: "MCP", direction: "depends-on" })]);
    expect(o.lifecycle.find((s) => s.stage === "brd")?.state).toBe("done");
    expect(o.plan?.milestones.find((m) => m.id === "M5")?.dependsOn).toContain("MCP:M4");
    const mcp = await project(acme(), "MCP");
    expect(mcp.related).toEqual([expect.objectContaining({ key: "SUP", direction: "used-by" })]);
    expect(mcp.lifecycle.find((s) => s.stage === "architecture")?.state).toBe("waiting");
  });

  it("flags an architecture built on a draft BRD, then marks it stale when the BRD changes", async () => {
    const before = await project(acme(), "UPI");
    expect(before.lifecycle.find((s) => s.stage === "architecture")?.note).toContain(
      "built on draft BRD-31 v0.3",
    );
    await acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-po", decision: "approve" });
    const after = await project(acme(), "UPI");
    expect(after.links.find((l) => l.id === "lk-1")?.state).toBe("stale");
    expect(after.lifecycle.find((s) => s.stage === "architecture")?.state).toBe("stale");
  });

  it("keeps projects inside their tenant", async () => {
    await expect(project(northwind(), "SUP")).rejects.toMatchObject({ status: 404 });
    const nw = await northwind().get("/portfolio", Portfolio);
    expect(nw.projects.map((x) => x.key)).toEqual(["ISO", "ONB", "CBS"]);
  });

  it("creates a project with a starter plan, for roles that can create work", async () => {
    const draft = {
      programId: "pgm-ai",
      name: "Claims triage agent",
      key: "CLM",
      objective: "Triage insurance claims with an agent and a human check.",
      sponsor: "Sanjay Menon",
      owner: "Priya Nair",
      teams: ["Support"],
      startDate: "2026-11-02",
      targetDate: "2027-04-30",
      budgetUsd: 200000,
      platform: false,
    };
    await expect(
      fabrikam().post("/projects", ProjectOverview, { ...draft, programId: "pgm-dig" }),
    ).rejects.toMatchObject({
      status: 403,
    });
    const o = await acme().post("/projects", ProjectOverview, draft);
    expect(o.project.key).toBe("CLM");
    expect(o.plan?.milestones).toHaveLength(2);
    await expect(acme().post("/projects", ProjectOverview, draft)).rejects.toMatchObject({ status: 409 });
  });

  it("requires a project for a new BRD and files it under a new work item there", async () => {
    await expect(acme().post("/brds", StudioState, { title: "No project" })).rejects.toMatchObject({
      status: 400,
    });
    const s = await acme().post("/brds", StudioState, { title: "Refund automation", projectId: "prj-mrc" });
    expect(s.brd.projectId).toBe("prj-mrc");
    const work = await acme().get("/work-items", WorkItemList);
    expect(work.items.find((w) => w.key === s.brd.workItemKey)?.projectId).toBe("prj-mrc");
    const mrc = await project(acme(), "MRC");
    expect(mrc.artifacts.some((a) => a.ref.id === s.brd.id)).toBe(true);
  });
});

describe("architecture components and choices", () => {
  it("explains each component with the requirements, NFRs, decisions and controls it serves", async () => {
    const list = await acme().get("/architectures", ArchitectureList);
    const mcp = list.items.find((a) => a.id === "arch-52");
    const registry = mcp?.components.find((c) => c.id === "mcp-registry");
    expect(registry?.product).toBe("Azure API Center");
    expect(registry?.serves.map((s) => s.id)).toEqual(expect.arrayContaining(["BR-04", "AD-14"]));
    const db = mcp?.components.find((c) => c.id === "db");
    expect(db?.serves.some((s) => s.kind === "nfr")).toBe(true);
    expect(db?.choice).toBe("database");
    expect(db?.docsUrl).toContain("learn.microsoft.com");
  });

  it("previews the impact of a choice, then applies it and records the change", async () => {
    const impact = await acme().post("/architectures/arch-52/preview", ChoiceImpact, {
      field: "compute",
      value: "kubernetes",
    });
    expect(impact.costAfter).toBeGreaterThan(impact.costBefore);
    expect(impact.added.some((x) => x.includes("Azure Kubernetes Service"))).toBe(true);
    expect(impact.decisions.some((d) => d.startsWith("AD-02"))).toBe(true);
    await expect(
      acme().post("/architectures/arch-52/preview", ChoiceImpact, { field: "compute", value: "mainframe" }),
    ).rejects.toMatchObject({ status: 400 });

    const after = await acme().post("/architectures/arch-52/choose", ArchitectureList, {
      field: "compute",
      value: "kubernetes",
    });
    const a = after.items.find((x) => x.id === "arch-52");
    expect(a?.brief.compute).toBe("kubernetes");
    expect(a?.revision).toBe(2);
    expect(a?.history[0]).toMatchObject({
      field: "compute",
      from: "serverless-containers",
      to: "kubernetes",
    });
    await expect(
      fabrikam().post("/architectures/arch-12/choose", ArchitectureList, { field: "cache", value: "no" }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
