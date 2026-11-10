import { BRANDS, brandDataUri, brandIn, brandOf, brandUrl } from "./brands";

describe("brand logos", () => {
  it("has a file for every registered brand", () => {
    for (const id of Object.keys(BRANDS) as (keyof typeof BRANDS)[]) expect(brandUrl(id), id).toBeTruthy();
  });

  it("resolves ids, tool names and product names", () => {
    expect(brandOf("azure-boards")).toBe("azure-devops");
    expect(brandOf("Microsoft Entra ID")).toBe("microsoft");
    expect(brandOf("Xray (Jira)")).toBe("xray");
    expect(brandOf("Zephyr Scale (Jira)")).toBe("zephyr");
    expect(brandOf("Google Workspace")).toBe("google");
    expect(brandOf("jira-mcp")).toBe("jira");
    expect(brandOf("sandbox-shell")).toBeNull();
  });

  it("finds products named inside diagram labels", () => {
    expect(brandIn("CRM (Salesforce)")).toBe("salesforce");
    expect(brandIn("Mail in Microsoft 365")).toBe("m365");
    expect(brandIn("Microsoft Teams channel")).toBe("teams");
    expect(brandIn("Core banking (T24)")).toBeNull();
    expect(brandDataUri("salesforce")).toMatch(/^data:image\/svg\+xml/);
  });

  it("covers every seeded integration", async () => {
    const { acmeSeed } = await import("@/mocks/seed/acme");
    expect(acmeSeed.integrations.filter((i) => !brandOf(i.id)).map((i) => i.id)).toEqual([]);
  });
});
