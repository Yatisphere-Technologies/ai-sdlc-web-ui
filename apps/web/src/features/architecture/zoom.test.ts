import { clampZoom, fitZoom } from "./zoom";

describe("diagram zoom", () => {
  it("fits the whole diagram, limited by the tighter side", () => {
    expect(fitZoom({ width: 1016, height: 516 }, { width: 2000, height: 500 })).toBe(0.5);
    expect(fitZoom({ width: 1016, height: 316 }, { width: 1000, height: 1000 })).toBe(0.3);
  });

  it("goes below 70% when asked to fit, unlike the readable first-load zoom", () => {
    expect(fitZoom({ width: 616, height: 2000 }, { width: 2400, height: 800 })).toBe(0.25);
    expect(fitZoom({ width: 616, height: 2000 }, { width: 2400, height: 800 }, true)).toBe(0.7);
  });

  it("never blows a small diagram up past 150%, and ignores an unmeasured frame", () => {
    expect(fitZoom({ width: 3016, height: 3016 }, { width: 500, height: 500 })).toBe(1.5);
    expect(fitZoom({ width: 0, height: 0 }, { width: 500, height: 500 })).toBeNull();
  });

  it("clamps manual zoom", () => {
    expect(clampZoom(5)).toBe(2);
    expect(clampZoom(0.1)).toBe(0.25);
  });
});
