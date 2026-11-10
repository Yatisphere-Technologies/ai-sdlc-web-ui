import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it("keeps in-app paths", () => {
    expect(safeRedirect("/t/acme/portfolio?x=1")).toBe("/t/acme/portfolio?x=1");
  });

  it("rejects anything that could leave the app or loop", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "/login",
      undefined,
      42,
    ]) {
      expect(safeRedirect(bad)).toBe("/workspaces");
    }
  });
});
