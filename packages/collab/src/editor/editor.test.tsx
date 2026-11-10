import { render, screen } from "@testing-library/react";
import { RichEditor } from "./RichEditor";
import { filterSlash, slashQuery } from "./SlashMenu";

describe("slash menu", () => {
  it("opens only for / at the start of a line", () => {
    expect(slashQuery("/")).toBe("");
    expect(slashQuery("/req")).toBe("req");
    expect(slashQuery("text /req")).toBeNull();
    expect(slashQuery("/a/b")).toBeNull();
  });

  it("filters by label and keywords", () => {
    const items = [
      { id: "a", label: "Requirement", group: "Items", keywords: ["shall"] },
      { id: "b", label: "Risk", group: "Items", keywords: ["issue"] },
    ];
    expect(filterSlash(items, "iss").map((i) => i.id)).toEqual(["b"]);
    expect(filterSlash(items, "").length).toBe(2);
  });
});

describe("RichEditor", () => {
  it("renders headings, text and host-rendered smart blocks", async () => {
    render(
      <RichEditor
        value={{
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2, anchor: "summary" },
              content: [{ type: "text", text: "Summary" }],
            },
            { type: "paragraph", content: [{ type: "text", text: "Hello world." }] },
            { type: "smartBlock", attrs: { kind: "req", ref: "req:1", data: { title: "Download reports" } } },
          ],
        }}
        onChange={() => {}}
        host={{
          refOf: (k, d) => `${k}:${String(d.title)}`,
          render: (p) => <p>Item: {String(p.data.title)}</p>,
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Summary" })).toHaveAttribute("data-anchor", "summary");
    expect(screen.getByText("Hello world.")).toBeInTheDocument();
    expect(await screen.findByText("Item: Download reports")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
  });
});
