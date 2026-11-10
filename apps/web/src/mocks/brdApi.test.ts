import { BacklogList, BrdList } from "@throughline/contracts";
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
const brd = async () => (await acme().get("/brds", BrdList)).items.find((b) => b.id === "BRD-31");
const backlog = async () =>
  (await acme().get("/backlogs", BacklogList)).items.find((b) => b.brdId === "BRD-31");

describe("BRD approval and backlog", () => {
  it("approves when the last approver signs, then generates and pushes the backlog", async () => {
    expect((await backlog())?.status).toBe("none");
    await expect(acme().post("/backlogs/bl-BRD-31/generate", BacklogList)).rejects.toMatchObject({
      status: 409,
    });

    await acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-po", decision: "approve" });
    const approved = await brd();
    expect(approved?.status).toBe("approved");
    expect(approved?.version).toBe("1.0");

    await acme().post("/backlogs/bl-BRD-31/generate", BacklogList);
    const ready = await backlog();
    expect(ready?.status).toBe("ready");
    expect(ready?.items.filter((i) => i.type === "epic").length).toBeGreaterThan(3);

    await acme().post("/backlogs/bl-BRD-31/push", BacklogList);
    const pushed = await backlog();
    expect(
      pushed?.items.filter((i) => i.type !== "feature").every((i) => i.external?.key.startsWith("UPI-")),
    ).toBe(true);
    // Jira has no Feature level: features become labels, not issues.
    expect(pushed?.items.filter((i) => i.type === "feature").every((i) => i.external === null)).toBe(true);
    // Pushing again creates nothing new.
    const keys = pushed?.items.map((i) => i.external?.key);
    await acme().post("/backlogs/bl-BRD-31/push", BacklogList);
    expect((await backlog())?.items.map((i) => i.external?.key)).toEqual(keys);
  });

  it("only lets you sign your own approval slot", async () => {
    await expect(
      acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-sponsor", decision: "approve" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("needs a reason to request changes, and locks content while in review", async () => {
    await expect(
      acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-po", decision: "request-changes" }),
    ).rejects.toMatchObject({ status: 400 });
    const b = await brd();
    await expect(acme().put("/brds/BRD-31/content", BrdList, b?.content)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("separates duties: whoever submits can't approve", async () => {
    await acme().post("/brds/BRD-31/decision", BrdList, {
      approvalId: "ap-po",
      decision: "request-changes",
      comment: "Add the refund rule from OQ-2",
    });
    expect((await brd())?.status).toBe("changes-requested");
    await acme().post("/brds/BRD-31/submit", BrdList);
    await expect(
      acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-po", decision: "approve" }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("a change request reopens an approved BRD and marks its backlog stale", async () => {
    await acme().post("/brds/BRD-31/decision", BrdList, { approvalId: "ap-po", decision: "approve" });
    await acme().post("/backlogs/bl-BRD-31/generate", BacklogList);
    await acme().post("/brds/BRD-31/change-request", BrdList, { reason: "Add auto-refund (OQ-2)" });
    expect((await brd())?.version).toBe("1.1");
    expect((await backlog())?.status).toBe("stale");
  });

  it("keeps viewers read-only and tenants apart", async () => {
    const fab = createTenantApi("t_fab4d0");
    await expect(fab.post("/brds/BRD-12/submit", BrdList)).rejects.toMatchObject({ status: 403 });
    expect((await fab.get("/brds", BrdList)).items.map((b) => b.id)).toEqual(["BRD-12"]);
    await expect(createTenantApi("t_other9z").get("/brds", BrdList)).rejects.toMatchObject({ status: 404 });
  });
});
