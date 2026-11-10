import { describe, expect, it } from "vitest";
import { parseChoice, resolveTheme } from "./theme";

describe("theme", () => {
  it("falls back to dark for unknown values", () => {
    expect(parseChoice("light")).toBe("light");
    expect(parseChoice("purple")).toBe("dark");
    expect(parseChoice(null)).toBe("dark");
  });
  it("follows the system only when asked", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
  });
});
