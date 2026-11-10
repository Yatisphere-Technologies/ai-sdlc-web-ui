import { routeContext, workspacePath } from "./pageContext";

describe("assistant page context", () => {
  it("strips the workspace prefix", () => {
    expect(workspacePath("/t/acme/testing?plan=tp-upi", "acme")).toBe("/testing?plan=tp-upi");
    expect(workspacePath("/t/acme", "acme")).toBe("/");
  });

  it("names the page and keeps the working project", () => {
    expect(routeContext("/projects/UPI", "prj-upi", "UPI")).toEqual({
      label: "Project UPI",
      path: "/projects/UPI",
      projectId: "prj-upi",
    });
    expect(routeContext("/testing?plan=tp-upi", "prj-upi", "UPI").label).toBe("Test plan · UPI");
    expect(routeContext("/settings/audit", null, null).label).toBe("Settings");
    expect(routeContext("/", null, null).label).toBe("Control room");
    expect(routeContext("/brd/BRD-31", null, null).label).toBe("BRD-31");
  });
});
