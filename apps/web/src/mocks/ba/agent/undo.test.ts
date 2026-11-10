import { describe, expect, it } from "vitest";
import { undoField } from "./undo";

const r = (id: string, text = id) => ({ id, text });

describe("undoField", () => {
  it("removes only the row an edit added, even after later additions", () => {
    const res = undoField([r("a"), r("b"), r("c")], [r("a")], [r("a"), r("b")]);
    expect(res?.value).toEqual([r("a"), r("c")]);
  });
  it("restores a changed row", () => {
    expect(undoField([r("a", "new"), r("c")], [r("a", "old")], [r("a", "new")])?.value).toEqual([
      r("a", "old"),
      r("c"),
    ]);
  });
  it("refuses when the row was edited since", () => {
    expect(undoField([r("a"), r("b", "edited")], [r("a")], [r("a"), r("b")])).toBeNull();
  });
  it("puts back a removed row", () => {
    expect(undoField([r("b")], [r("a"), r("b")], [r("b")])?.value).toEqual([r("a"), r("b")]);
  });
  it("compares whole values for plain fields", () => {
    expect(undoField("x2", "x", "x2")?.value).toBe("x");
    expect(undoField("x3", "x", "x2")).toBeNull();
  });
});
