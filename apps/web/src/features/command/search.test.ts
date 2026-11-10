import { describe, expect, it } from "vitest";
import { type CommandItem, searchCommands } from "./search";

const items: CommandItem[] = [
  { id: "1", group: "Pages", label: "Approvals", path: "/approvals" },
  { id: "2", group: "Projects", label: "UPI · UPI AutoPay", path: "/projects/UPI", keywords: "payments" },
  { id: "3", group: "BRDs", label: "BRD-40 · Agentic email listener", path: "/brd/BRD-40" },
  { id: "4", group: "Pages", label: "Test plan", path: "/testing" },
];

describe("searchCommands", () => {
  it("shows pages when empty", () => {
    expect(searchCommands(items, "").map((i) => i.id)).toEqual(["1", "4"]);
  });
  it("needs every word and ranks prefixes first", () => {
    expect(searchCommands(items, "email brd").map((i) => i.id)).toEqual(["3"]);
    expect(searchCommands(items, "payments")[0]?.id).toBe("2");
    expect(searchCommands(items, "zzz")).toEqual([]);
  });
  it("is safe with regex characters", () => {
    expect(() => searchCommands(items, "(a+")).not.toThrow();
  });
});
