import { parseInline, parseMarkdown, plainText } from "./chat/parseMarkdown";
import { changeRatio, diffWords, tokenize } from "./doc/diff";

describe("diffWords", () => {
  it("round-trips both sides", () => {
    const before = "Customers can't cancel quickly, so they call support.";
    const after = "Customers cannot cancel within 2 minutes, so they call support.";
    const parts = diffWords(before, after);
    expect(
      parts
        .filter((p) => p.type !== "add")
        .map((p) => p.text)
        .join(""),
    ).toBe(before);
    expect(
      parts
        .filter((p) => p.type !== "del")
        .map((p) => p.text)
        .join(""),
    ).toBe(after);
    expect(parts.some((p) => p.type === "del" && /quickly/.test(p.text))).toBe(true);
    expect(parts.some((p) => p.type === "add" && /within 2 minutes/.test(p.text))).toBe(true);
  });

  it("handles empty sides and identical text", () => {
    expect(diffWords("", "New text")).toEqual([{ type: "add", text: "New text" }]);
    expect(diffWords("Old", "")).toEqual([{ type: "del", text: "Old" }]);
    expect(diffWords("Same", "Same")).toEqual([{ type: "same", text: "Same" }]);
    expect(changeRatio(diffWords("Same", "Same"))).toBe(0);
  });

  it("keeps whitespace in the tokens", () => {
    expect(tokenize("a  b, c").join("")).toBe("a  b, c");
  });
});

describe("markdown", () => {
  it("parses lists, bold, code and links", () => {
    const blocks = parseMarkdown("Found **3** gaps:\n- one `BR-01`\n- two\n\n1. first\n2. second");
    expect(blocks.map((b) => b.type)).toEqual(["p", "ul", "ol"]);
    expect(blocks[0]).toMatchObject({
      type: "p",
      children: [{ text: "Found " }, { type: "strong" }, { text: " gaps:" }],
    });
  });

  it("never links unsafe URLs", () => {
    expect(parseInline("[x](javascript:alert(1))").some((n) => n.type === "link")).toBe(false);
    expect(parseInline("see https://npci.org.in.")[1]).toMatchObject({
      type: "link",
      href: "https://npci.org.in",
    });
  });

  it("extracts plain text", () => {
    expect(plainText("**Hi**\n• a\n• b")).toBe("Hi\n\n• a\n• b");
  });
});
