import { render, screen } from "@testing-library/react";
import { clampPercent, Progress } from "./Progress";
import { toPoints } from "./Sparkline";

describe("Progress", () => {
  it("clamps out-of-range values", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });

  it("exposes an accessible progressbar", () => {
    render(<Progress value={72} label="builder-1 progress" />);
    expect(screen.getByRole("progressbar", { name: "builder-1 progress" })).toHaveAttribute(
      "aria-valuenow",
      "72",
    );
  });
});

describe("toPoints", () => {
  it("maps the highest value to the top of the box", () => {
    const pts = toPoints([0, 10], 200, 40, 4).split(" ");
    expect(pts[0]).toBe("0,36");
    expect(pts[1]).toBe("200,4");
  });
});
