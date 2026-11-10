import {
  AgentGovernance,
  AuditPage,
  ControlRoom,
  GateDecision,
  MemberList,
  SecuritySettings,
  StudioState,
  TENANT_HEADER,
  WorkItemList,
} from "@throughline/contracts";
import { ApiError, createTenantApi } from "@/api/http";
import { FOREIGN_TENANT_ID, resetDb, setSignedIn } from "./db";
import { mockServer } from "./node";

const BASE = window.location.origin;
let realFetch: typeof fetch;

beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: "error" });
  // Node's fetch can't resolve relative /api URLs, so prefix the jsdom origin (which MSW also uses).
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

describe("tenant isolation", () => {
  it("rejects every tenant call when signed out", async () => {
    setSignedIn(false);
    await expect(createTenantApi("t_acme7f").get("/work-items", WorkItemList)).rejects.toMatchObject({
      status: 401,
    });
  });

  it("returns only the requesting tenant's data", async () => {
    const acme = await createTenantApi("t_acme7f").get("/work-items", WorkItemList);
    const northwind = await createTenantApi("t_nwb21c").get("/work-items", WorkItemList);
    const acmeKeys = new Set(acme.items.map((i) => i.key));
    expect(northwind.items.some((i) => acmeKeys.has(i.key))).toBe(false);
  });

  it("rejects a header that disagrees with the path", async () => {
    const res = await fetch(`${BASE}/api/t/t_acme7f/work-items`, {
      headers: { [TENANT_HEADER]: "t_nwb21c" },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("tenant_mismatch");
  });

  it("hides tenants the user is not a member of (404, not 403)", async () => {
    await expect(createTenantApi(FOREIGN_TENANT_ID).get("/control-room", ControlRoom)).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("refuses to build a client for a malformed tenant id", () => {
    expect(() => createTenantApi("t_../acme")).toThrow();
  });

  it("enforces role permissions server-side", async () => {
    // Priya is an architect in Northwind: she can approve G2 but not G1.
    const api = createTenantApi("t_nwb21c");
    const err = await api.post("/gates/d-g1-spec77/approve", GateDecision).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
  });

  it("a write in one tenant does not touch another", async () => {
    await createTenantApi("t_acme7f").patch("/security/controls/mfa", SecuritySettings, { enabled: false });
    const northwind = await createTenantApi("t_nwb21c").get("/security", SecuritySettings);
    expect(northwind.controls.find((c) => c.id === "mfa")?.enabled).toBe(true);
  });

  it("keeps members, agents and the audit log inside their tenant", async () => {
    await createTenantApi("t_acme7f").post("/members", MemberList, {
      email: "new.dev@acmepay.example",
      roles: ["engineer"],
    });
    const nw = await createTenantApi("t_nwb21c").get("/members", MemberList);
    expect(nw.items.some((m) => m.email === "new.dev@acmepay.example")).toBe(false);
    await expect(createTenantApi(FOREIGN_TENANT_ID).get("/audit", AuditPage)).rejects.toMatchObject({
      status: 404,
    });
    await expect(createTenantApi(FOREIGN_TENANT_ID).get("/agents", AgentGovernance)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("keeps BRD comments inside their tenant", async () => {
    const comment = { anchor: { section: "summary", rowId: null, quote: null }, text: "Looks good" };
    await expect(
      createTenantApi(FOREIGN_TENANT_ID).post("/brds/BRD-31/comments", StudioState, comment),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      // Northwind's BRD-199 doesn't exist in Acme, even for an Acme editor.
      createTenantApi("t_acme7f").post("/brds/BRD-199/comments", StudioState, comment),
    ).rejects.toMatchObject({ status: 404 });
  });
});
