import { BrdList, TestPlanList } from "@throughline/contracts";
import { createTenantApi } from "@/api/http";
import { resetDb, setSignedIn } from "./db";
import { mockServer } from "./node";

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
const plans = async (api = acme()) => (await api.get("/test-plans", TestPlanList)).items;
const plan = async (id: string, api = acme()) => (await plans(api)).find((x) => x.id === id);

describe("test plans", () => {
  it("seeds a plan for every project in every tenant", async () => {
    expect((await plans()).map((x) => x.id).sort()).toEqual(
      ["tp-card", "tp-kyc", "tp-mcp", "tp-mrc", "tp-sup", "tp-upi"].sort(),
    );
    expect((await plans(northwind())).map((x) => x.id).sort()).toEqual(["tp-cbs", "tp-iso", "tp-onb"]);
    expect((await plans(fabrikam())).map((x) => x.id).sort()).toEqual(["tp-chk", "tp-loy"]);
  });

  it("covers every Must requirement, NFR and security control, with AI evaluation for agent work", async () => {
    const sup = await plan("tp-sup");
    expect(sup?.coverage.requirements.covered).toBe(sup?.coverage.requirements.total);
    expect(sup?.coverage.nfrs.covered).toBe(sup?.coverage.nfrs.total);
    expect(sup?.coverage.controls.covered).toBe(sup?.coverage.controls.total);
    expect(sup?.cases.some((c) => c.level === "ai-eval")).toBe(true);
    expect(sup?.exit.find((e) => e.id === "E1")?.met).toBe(true);
    const story = sup?.cases.find((c) => c.traces.some((t) => t.kind === "story"));
    expect(story?.traces.some((t) => t.kind === "requirement")).toBe(true);
  });

  it("goes out of date when its BRD changes, and regenerates", async () => {
    expect((await plan("tp-upi"))?.status).toBe("approved");
    await acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-po", decision: "approve" });
    expect((await plan("tp-upi"))?.status).toBe("stale");
    await expect(acme().post("/test-plans/tp-upi/runs", TestPlanList)).rejects.toMatchObject({ status: 409 });
    await acme().post("/test-plans/tp-upi/generate", TestPlanList);
    const fresh = await plan("tp-upi");
    expect(fresh?.status).toBe("draft");
    expect(fresh?.basis.brd?.version).toBe("1.0");
    expect(fresh?.cases.some((c) => c.traces.some((t) => t.id === "INT-29"))).toBe(true);
  });

  it("runs the approval flow, pushes to each tool and records CI results", async () => {
    await acme().post("/test-plans/tp-mcp/decision", TestPlanList, {
      decision: "approve",
      approvalId: "sec",
    });
    const after = await acme().post("/test-plans/tp-mcp/decision", TestPlanList, {
      decision: "approve",
      approvalId: "ai",
    });
    const mcp = after.items.find((x) => x.id === "tp-mcp");
    expect(mcp?.status).toBe("approved");
    expect(mcp?.version).toBe("1.0");

    const pushed = await acme().post("/test-plans/tp-mcp/push", TestPlanList, { target: "zephyr" });
    expect(pushed.items.find((x) => x.id === "tp-mcp")?.cases[0]?.external).toBe("MCP-T1");
    await expect(
      acme().post("/test-plans/tp-mcp/push", TestPlanList, { target: "azure-test-plans" }),
    ).rejects.toMatchObject({ status: 409 });

    const ran = await acme().post("/test-plans/tp-mcp/runs", TestPlanList);
    const r = ran.items.find((x) => x.id === "tp-mcp");
    expect(r?.runs).toHaveLength(1);
    expect(r?.coverage.executed).toBeGreaterThan(0);
  });

  it("only lets roles that create work change plans", async () => {
    await expect(fabrikam().post("/test-plans/tp-chk/runs", TestPlanList)).rejects.toMatchObject({
      status: 403,
    });
    await expect(northwind().post("/test-plans/tp-iso/generate", TestPlanList)).rejects.toMatchObject({
      status: 403,
    });
  });
});
