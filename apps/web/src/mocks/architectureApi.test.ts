import { ArchitectureList } from "@throughline/contracts";
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

const northwind = () => createTenantApi("t_nwb21c");
const fabrikam = () => createTenantApi("t_fab4d0");
const first = async (api: ReturnType<typeof createTenantApi>) =>
  (await api.get("/architectures", ArchitectureList)).items[0];

describe("architecture studio API", () => {
  it("starts Northwind at the brief, with the agent's suggestions pre-filled", async () => {
    const a = await first(northwind());
    expect(a?.status).toBe("brief");
    expect(a?.brief.region).toBe("uae");
    expect(a?.suggestions.keys?.basis).toBe("stated");
    expect(a?.diagrams).toHaveLength(0);
  });

  it("saves a brief and generates diagrams and a document from it", async () => {
    const a = await first(northwind());
    if (!a) throw new Error("seed");
    await northwind().put(`/architectures/${a.id}/brief`, ArchitectureList, { ...a.brief, cloud: "aws" });
    await northwind().post(`/architectures/${a.id}/generate`, ArchitectureList);
    const done = await first(northwind());
    expect(done?.status).toBe("ready");
    expect(done?.revision).toBe(1);
    expect(done?.diagrams).toHaveLength(5);
    expect(done?.document?.summary).toContain("Amazon Web Services");
  });

  it("marks the pack stale when the brief changes after generation", async () => {
    const acme = createTenantApi("t_acme7f");
    const a = await first(acme);
    if (!a) throw new Error("seed");
    expect(a.status).toBe("ready");
    await acme.put(`/architectures/${a.id}/brief`, ArchitectureList, { ...a.brief, cache: "no" });
    const after = await first(acme);
    expect(after?.status).toBe("stale");
    expect(after?.diagrams).toHaveLength(5);
  });

  it("rejects an incomplete brief", async () => {
    await expect(
      northwind().put("/architectures/arch-199/brief", ArchitectureList, { cloud: "azure" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("lets only architects edit, and keeps tenants apart", async () => {
    const a = await first(fabrikam());
    if (!a) throw new Error("seed");
    // Viewer in Fabrikam.
    await expect(fabrikam().post(`/architectures/${a.id}/generate`, ArchitectureList)).rejects.toMatchObject({
      status: 403,
    });
    // Northwind's architecture id doesn't exist in Fabrikam.
    const nw = await first(northwind());
    expect((await fabrikam().get("/architectures", ArchitectureList)).items.map((x) => x.id)).not.toContain(
      nw?.id,
    );
    // A tenant the user is not a member of.
    await expect(createTenantApi("t_other9z").get("/architectures", ArchitectureList)).rejects.toMatchObject({
      status: 404,
    });
  });
});
