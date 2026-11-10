import {
  AgentGovernance,
  AuditPage,
  IdentitySettings,
  MemberList,
  postureScore,
  SecuritySettings,
} from "@throughline/contracts";
import { createTenantApi } from "@/api/http";
import { getStore, resetDb, setSignedIn } from "./db";
import { mockServer } from "./node";
import { verifyChain } from "./security/chain";

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
const audit = async () => (await acme().get("/audit?limit=5", AuditPage)).items;

describe("security and data", () => {
  it("reports findings that point at the tab that fixes them", async () => {
    const s = await fabrikam().get("/security", SecuritySettings);
    const ids = s.findings.map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining(["admin-no-mfa", "sso-off", "review-due", "no-break-glass", "policies-off"]),
    );
    expect(s.findings[0]?.severity).toBe("high");
    expect(postureScore(s.controls, s.findings)).toBeLessThan(postureScore(s.controls));
    const nw = await northwind().get("/security", SecuritySettings);
    expect(nw.findings.filter((f) => f.severity === "high")).toEqual([]);
  });

  it("won't let an IP rule lock you out, and logs the change", async () => {
    const s = await acme().get("/security", SecuritySettings);
    const ip = s.controls.find((c) => c.id === "ip");
    if (ip?.config?.kind !== "ip-ranges") throw new Error("seed");
    await expect(
      acme().patch("/security/controls/ip", SecuritySettings, {
        enabled: true,
        config: { ...ip.config, ranges: [{ cidr: "10.0.0.0/8", label: "VPN" }] },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      acme().patch("/security/controls/ip", SecuritySettings, {
        config: { ...ip.config, ranges: [{ cidr: "10.0.0/8", label: "Bad" }] },
      }),
    ).rejects.toMatchObject({ status: 400 });
    const on = await acme().patch("/security/controls/ip", SecuritySettings, { enabled: true });
    expect(on.controls.find((c) => c.id === "ip")?.enabled).toBe(true);
    expect((await audit())[0]).toMatchObject({
      action: "Turned on",
      category: "security",
      outcome: "success",
    });
  });

  it("changes a control's setting and its label follows", async () => {
    const s = await acme().patch("/security/controls/session", SecuritySettings, {
      config: { kind: "hours", value: 4, options: [1, 4, 8, 12, 24] },
    });
    expect(s.controls.find((c) => c.id === "session")?.label).toBe("Sign out after 4 hours idle");
  });

  it("rotates, revokes and restores a customer key; platform keys can't", async () => {
    const r = await acme().post("/security/keys/rotate", SecuritySettings);
    expect(r.keys.versions[0]).toMatchObject({ version: "v5", status: "active" });
    expect(r.keys.versions.filter((v) => v.status === "active")).toHaveLength(1);
    await expect(
      acme().post("/security/keys/revoke", SecuritySettings, { confirm: "nope" }),
    ).rejects.toMatchObject({
      status: 400,
    });
    const revoked = await acme().post("/security/keys/revoke", SecuritySettings, { confirm: "acme" });
    expect(revoked.findings[0]?.id).toBe("key-revoked");
    const back = await acme().post("/security/keys/restore", SecuritySettings);
    expect(back.keys.status).toBe("active");
    expect(getStore("t_fab4d0")?.security.keys.mode).toBe("platform-key");
  });

  it("needs a SCIM token before SCIM can be switched on", async () => {
    const store = getStore("t_acme7f");
    if (store) store.identity.scim.token = null;
    await acme().patch("/security/controls/scim", SecuritySettings, { enabled: false });
    await expect(
      acme().patch("/security/controls/scim", SecuritySettings, { enabled: true }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("members and roles", () => {
  it("only invites people on a verified domain while SSO is enforced", async () => {
    await expect(
      acme().post("/members", MemberList, { email: "someone@gmail.example", roles: ["engineer"] }),
    ).rejects.toMatchObject({ status: 409 });
    const r = await acme().post("/members", MemberList, {
      email: "new.dev@acmepay.example",
      roles: ["engineer"],
    });
    expect(r.items.find((m) => m.email === "new.dev@acmepay.example")).toMatchObject({
      status: "invited",
      name: "New Dev",
    });
  });

  it("protects admins: not yourself, not the last one, not SCIM-managed roles", async () => {
    await expect(
      acme().patch("/members/u_priya", MemberList, { roles: ["product-owner"] }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      acme().patch("/members/u_rahul", MemberList, { roles: ["architect"] }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(acme().delete("/members/u_rahul", MemberList)).rejects.toMatchObject({ status: 409 });
    const r = await acme().patch("/members/u_rohit", MemberList, { status: "suspended" });
    expect(r.items.find((m) => m.id === "u_rohit")?.status).toBe("suspended");
  });

  it("enforces permissions from the role matrix and logs refusals", async () => {
    await expect(northwind().post("/members/review", MemberList)).rejects.toMatchObject({ status: 403 });
    const last = getStore("t_nwb21c")?.audit.at(-1);
    expect(last).toMatchObject({ outcome: "denied", action: "Change refused" });
    await expect(fabrikam().get("/audit", AuditPage)).rejects.toMatchObject({ status: 403 });
  });

  it("re-applies group mappings to synced members", async () => {
    const id = await acme().get("/identity", IdentitySettings);
    const mappings = id.scim.mappings.map((m) =>
      m.group === "TL-Architects" ? { ...m, roles: ["architect", "tech-lead"] as const } : m,
    );
    await acme().put("/identity/scim/mappings", IdentitySettings, { mappings });
    const ms = await acme().get("/members", MemberList);
    expect(ms.items.find((m) => m.id === "u_vikram")?.roles).toEqual(["architect", "tech-lead"]);
  });
});

describe("SSO and SCIM", () => {
  it("shows a new SCIM token once and keeps only its last four characters", async () => {
    const r = await acme().post("/identity/scim/token", IdentitySettings);
    expect(r.secret).toMatch(/^scim_/);
    expect(r.scim.token?.last4).toBe(r.secret?.slice(-4));
    expect((await acme().get("/identity", IdentitySettings)).secret).toBeUndefined();
  });

  it("needs a verified domain and a break-glass admin to enforce SSO", async () => {
    // Fabrikam has neither; patch its store to make Priya an admin there for this test.
    const store = getStore("t_fab4d0");
    const me = store?.members.items.find((m) => m.id === "u_priya");
    if (me) me.roles = ["tenant-admin"];
    await expect(
      fabrikam().patch("/identity/sso", IdentitySettings, { enforced: true }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await fabrikam().post("/identity/domains/fabrikam.example/verify", IdentitySettings);
    await expect(
      fabrikam().patch("/identity/sso", IdentitySettings, { enforced: true }),
    ).rejects.toMatchObject({
      status: 409,
    });
  });
});

describe("agents and policies", () => {
  it("keeps production behind a person and restricted data behind redaction", async () => {
    await expect(
      acme().patch("/agents/release-agent", AgentGovernance, { autonomy: "act" }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      acme().patch("/policies/prod-approval", AgentGovernance, { enabled: false }),
    ).rejects.toMatchObject({
      status: 409,
    });
    await acme().patch("/security/controls/pii", SecuritySettings, { enabled: false });
    await expect(
      acme().patch("/agents/qa-agent", AgentGovernance, { dataAccess: "restricted" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("stops every agent with the kill switch and restores only those it stopped", async () => {
    await acme().patch("/agents/explorer", AgentGovernance, { status: "suspended" });
    const stopped = await acme().post("/agents/kill-switch", AgentGovernance, {
      engaged: true,
      reason: "Drill",
    });
    expect(stopped.agents.every((a) => a.status === "suspended")).toBe(true);
    await expect(
      acme().patch("/agents/builder-1", AgentGovernance, { status: "active" }),
    ).rejects.toMatchObject({
      status: 409,
    });
    const back = await acme().post("/agents/kill-switch", AgentGovernance, {
      engaged: false,
      reason: "Drill over",
    });
    expect(back.agents.find((a) => a.id === "explorer")?.status).toBe("suspended");
    expect(back.agents.find((a) => a.id === "builder-1")?.status).toBe("active");
  });
});

describe("audit log", () => {
  it("is hash-chained, filterable and grows with every security change", async () => {
    const before = await acme().get("/audit", AuditPage);
    expect(before.chain.verified).toBe(true);
    await acme().post("/members/review", MemberList);
    const after = await acme().get("/audit?category=access&actor=human", AuditPage);
    expect(after.total).toBe(before.total + 1);
    expect(after.items[0]?.action).toBe("Certified access");
    expect(after.items.every((e) => e.category === "access" && e.actor.type === "human")).toBe(true);
  });

  it("detects tampering", () => {
    const chain = structuredClone(getStore("t_acme7f")?.audit ?? []);
    expect(verifyChain(chain)).toBeNull();
    const victim = chain[4];
    if (victim) victim.detail = "edited";
    expect(verifyChain(chain)).toBe(5);
  });
});
