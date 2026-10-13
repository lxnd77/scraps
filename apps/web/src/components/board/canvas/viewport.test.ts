import { describe, expect, it } from "vitest";
import { fitTo, HOME, MAX_ZOOM, MIN_ZOOM, screenToWorld, visibleWorld, zoomAt } from "./viewport";

describe("canvas viewport", () => {
  it("keeps the point under the cursor still while zooming", () => {
    const view = { x: 40, y: -20, zoom: 1 };
    const at = { x: 300, y: 200 };
    const before = screenToWorld(view, at);
    const after = screenToWorld(zoomAt(view, 1.5, at), at);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("clamps zoom", () => {
    expect(zoomAt(HOME, 10, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
    expect(zoomAt(HOME, 0.01, { x: 0, y: 0 }).zoom).toBe(MIN_ZOOM);
  });

  it("fits a board without zooming in past 100%", () => {
    const size = { w: 1000, h: 800 };
    expect(fitTo({ x: 0, y: 0, w: 200, h: 200 }, size).zoom).toBe(1);
    const wide = fitTo({ x: 0, y: 0, w: 4000, h: 400 }, size);
    expect(wide.zoom).toBeLessThan(1);
    const shown = visibleWorld(wide, size);
    expect(shown.x).toBeLessThanOrEqual(0);
    expect(shown.x + shown.w).toBeGreaterThanOrEqual(4000);
    expect(fitTo(null, size)).toEqual(HOME);
  });
});
