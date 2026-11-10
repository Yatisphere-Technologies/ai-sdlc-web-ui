import { fireEvent, render, screen } from "@testing-library/react";
import { ratioAt, SplitPane } from "./SplitPane";

describe("SplitPane", () => {
  it("keeps both panes above their minimum width when dragged", () => {
    const box = { left: 0, width: 1000 };
    expect(ratioAt(500, box, 300, 400)).toBe(0.5);
    expect(ratioAt(100, box, 300, 400)).toBe(0.3);
    expect(ratioAt(900, box, 300, 400)).toBe(0.6);
  });

  it("resizes with the arrow keys and hides the divider when a side is collapsed", () => {
    const { rerender } = render(
      <SplitPane
        start={<p>Chat</p>}
        end={<p>Doc</p>}
        startLabel="Chat"
        endLabel="Document"
        defaultRatio={0.4}
      />,
    );
    const sep = screen.getByRole("separator", { name: "Resize Chat and Document" });
    expect(sep).toHaveAttribute("aria-valuenow", "40");
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(sep).toHaveAttribute("aria-valuenow", "43");
    rerender(
      <SplitPane
        start={<p>Chat</p>}
        end={<p>Doc</p>}
        startLabel="Chat"
        endLabel="Document"
        collapsed="end"
      />,
    );
    expect(screen.queryByRole("separator")).toBeNull();
  });
});
