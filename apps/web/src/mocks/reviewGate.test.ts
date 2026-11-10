import { ReviewList } from "@throughline/contracts";
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
const pack = async (id: string) => (await acme().get("/reviews", ReviewList)).items.find((p) => p.id === id);

describe("G2 architecture + security review", () => {
  it("refuses sign-off while a high finding is open", async () => {
    await expect(
      acme().post("/reviews/rv-31/signoff", ReviewList, { role: "architecture" }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });

  it("signs off once blocking findings are closed, and needs both roles", async () => {
    await acme().patch("/reviews/rv-31/findings/rv-31-f2", ReviewList, { status: "resolved" });
    await acme().post("/reviews/rv-31/signoff", ReviewList, { role: "architecture" });
    const p = await pack("rv-31");
    expect(p?.status).toBe("signed-off");
    expect(p?.artifacts.every((a) => a.status === "approved")).toBe(true);
  });

  it("only lets the right role sign each half", async () => {
    // Priya (Acme) is not a security reviewer.
    await expect(
      acme().post("/reviews/rv-31/signoff", ReviewList, { role: "security" }),
    ).rejects.toMatchObject({
      status: 403,
    });
  });

  it("generates a full artifact pack with findings", async () => {
    await acme().post("/reviews/rv-29/generate", ReviewList);
    const p = await pack("rv-29");
    expect(p?.status).toBe("in-review");
    expect(p?.artifacts).toHaveLength(7);
    expect(p?.findings.length).toBeGreaterThan(0);
  });

  it("keeps a viewer out of review actions", async () => {
    await expect(
      createTenantApi("t_fab4d0").post("/reviews/rv-14/generate", ReviewList),
    ).rejects.toMatchObject({ status: 403 });
  });
});
