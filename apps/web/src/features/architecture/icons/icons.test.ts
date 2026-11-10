import { VENDOR_ICON_ROLES, vendorIcon } from "./index";

describe("vendor icons", () => {
  it("bundles the official Azure icons for the core roles", () => {
    for (const role of [
      "apigw",
      "kubernetes",
      "serverless-containers",
      "postgres",
      "queue",
      "secrets",
      "firewall",
      "siem",
      "api-catalog",
      "content-safety",
    ])
      expect(VENDOR_ICON_ROLES.azure, role).toContain(role);
    expect(vendorIcon("azure", "apigw")).toMatch(/^data:image\/svg\+xml/);
    expect(vendorIcon("azure", "staff")).toBe(vendorIcon("azure", "users"));
  });

  it("falls back to our icons on clouds without a bundled set", () => {
    expect(vendorIcon("aws", "apigw")).toBeNull();
    expect(vendorIcon("azure", "onprem-dc")).toBeNull();
  });
});
