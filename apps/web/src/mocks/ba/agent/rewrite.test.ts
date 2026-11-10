import { rewrite, rewriteKind } from "./rewrite";

describe("agent rewrites", () => {
  it("recognises what the author asked for", () => {
    expect(rewriteKind("Make this concise")).toBe("concise");
    expect(rewriteKind("make it measurable")).toBe("measurable");
    expect(rewriteKind("More formal please")).toBe("formal");
    expect(rewriteKind("fix the grammar")).toBe("grammar");
    expect(rewriteKind("expand on this")).toBe("expand");
    expect(rewriteKind("what time is it")).toBeNull();
  });

  it("tightens filler and long text", () => {
    expect(rewrite("In order to cancel, customers basically have to call support.", "concise", null)).toBe(
      "To cancel, customers have to call support.",
    );
    expect(rewrite("One. Two. Three. Four.", "concise", null, 2)).toBe("One. Two.");
  });

  it("only changes the quoted passage", () => {
    const text = "Customers can't cancel. Ops emails the PSP.";
    expect(rewrite(text, "formal", "Customers can't cancel")).toBe(
      "Customers cannot cancel. Ops emails the PSP.",
    );
  });

  it("replaces vague words with measurable placeholders", () => {
    expect(rewrite("The page must load quickly.", "measurable", null)).toBe(
      "The page must load within 2 seconds at p95.",
    );
  });
});
