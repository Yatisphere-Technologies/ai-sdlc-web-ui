import { postureScore, Tenant, TenantId, tenantApiPath } from "./index";

describe("tenancy contract", () => {
  it("accepts well-formed tenant ids and rejects others", () => {
    expect(TenantId.safeParse("t_acme7f").success).toBe(true);
    expect(TenantId.safeParse("acme").success).toBe(false);
    expect(TenantId.safeParse("t_../other").success).toBe(false);
  });

  it("builds tenant-scoped API paths", () => {
    expect(tenantApiPath("t_acme7f", "/work-items")).toBe("/api/t/t_acme7f/work-items");
  });

  it("rejects a tenant without a region", () => {
    const result = Tenant.safeParse({ id: "t_acme7f", slug: "acme", name: "Acme" });
    expect(result.success).toBe(false);
  });
});

describe("postureScore", () => {
  const c = (enabled: boolean, recommended = true) => ({
    id: String(Math.random()),
    group: "access" as const,
    label: "x",
    description: "y",
    enabled,
    recommended,
    config: null,
    frameworks: [],
  });

  it("counts only recommended controls", () => {
    expect(postureScore([c(true), c(false), c(false, false)])).toBe(50);
  });

  it("is 100 when nothing is recommended", () => {
    expect(postureScore([c(false, false)])).toBe(100);
  });

  it("takes points off for open findings", () => {
    expect(postureScore([c(true)], [{ severity: "high" }, { severity: "medium" }, { severity: "low" }])).toBe(
      93,
    );
  });
});

import { blockingFindings } from "./index";

describe("review gate", () => {
  const f = (severity: "critical" | "high" | "medium" | "low", status: "open" | "resolved" | "accepted") => ({
    id: severity + status,
    artifactId: "a",
    severity,
    title: "",
    detail: "",
    status,
    resolvedBy: null,
  });

  it("blocks only on open critical or high findings", () => {
    const pack = {
      findings: [f("high", "open"), f("critical", "accepted"), f("medium", "open"), f("high", "resolved")],
    };
    expect(blockingFindings(pack).map((x) => x.id)).toEqual(["highopen"]);
  });
});
