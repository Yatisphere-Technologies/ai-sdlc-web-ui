import type { Session } from "@throughline/contracts";
import { resolveTenant, tenantSlugFromHost } from "./resolveTenant";

const session: Session = {
  user: { id: "u1", name: "Priya N.", email: "priya@example.com", initials: "PN" },
  tenants: [
    {
      id: "t_acme7f",
      slug: "acme",
      name: "Acme",
      plan: "business",
      region: "in-mumbai",
      isolation: "isolated",
      encryption: "customer-key",
      identityProvider: "Entra ID",
      features: [],
    },
    {
      id: "t_orph01",
      slug: "orphan",
      name: "Orphan",
      plan: "team",
      region: "us-virginia",
      isolation: "pooled",
      encryption: "platform-key",
      identityProvider: "Google",
      features: [],
    },
  ],
  memberships: [{ tenantId: "t_acme7f", roles: ["viewer"], allowedActions: [] }],
};

describe("resolveTenant", () => {
  it("resolves a tenant the user belongs to", () => {
    expect(resolveTenant(session, "acme")?.tenant.id).toBe("t_acme7f");
  });

  it("treats unknown and not-a-member the same", () => {
    expect(resolveTenant(session, "nope")).toBeNull();
    expect(resolveTenant(session, "orphan")).toBeNull();
  });
});

describe("tenantSlugFromHost", () => {
  it("reads the subdomain under the base domain", () => {
    expect(tenantSlugFromHost("acme.throughline.app", "throughline.app")).toBe("acme");
    expect(tenantSlugFromHost("ACME.Throughline.app", "throughline.app")).toBe("acme");
  });

  it("ignores the bare domain, reserved names, nested subdomains and other domains", () => {
    expect(tenantSlugFromHost("throughline.app", "throughline.app")).toBeNull();
    expect(tenantSlugFromHost("www.throughline.app", "throughline.app")).toBeNull();
    expect(tenantSlugFromHost("a.b.throughline.app", "throughline.app")).toBeNull();
    expect(tenantSlugFromHost("acme.evil.com", "throughline.app")).toBeNull();
    expect(tenantSlugFromHost("localhost", "throughline.app")).toBeNull();
    expect(tenantSlugFromHost("acme.throughline.app", "")).toBeNull();
  });
});
