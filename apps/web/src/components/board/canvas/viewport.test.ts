import { describe, expect, it } from "vitest";
import {
  clampView,
  fitTo,
  HOME,
  initialView,
  isMouseWheel,
  TRACKPAD_BURST_MS,
  PHONE_HOME,
  MAX_ZOOM,
  MIN_ZOOM,
  panToShow,
  screenToWorld,
  visibleWorld,
  zoomAt,
} from "./viewport";

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

  it("keeps the bottom room for the floating controls clear", () => {
    const size = { w: 800, h: 600 };
    const tall = { x: 0, y: 0, w: 300, h: 900 };
    const view = fitTo(tall, size, 32, 96);
    const bottomOnScreen = (tall.y + tall.h) * view.zoom + view.y;
    expect(bottomOnScreen).toBeLessThanOrEqual(size.h - 96 + 0.001);
    expect(tall.y * view.zoom + view.y).toBeCloseTo(32);
  });
});

describe("keeping the board in view", () => {
  const size = { w: 800, h: 600 };
  const bounds = { x: 0, y: 0, w: 1000, h: 400 };

  it("stops panning once only a sliver of the board is left", () => {
    // panned far up and left: the board would be entirely off screen
    const v = clampView({ x: -5000, y: -5000, zoom: 1 }, bounds, size);
    expect(v.x + bounds.w).toBe(120);
    expect(v.y + bounds.h).toBe(120);
    // and far down and right
    const w = clampView({ x: 5000, y: 5000, zoom: 1 }, bounds, size);
    expect(w).toEqual({ x: 800 - 120, y: 600 - 120, zoom: 1 });
  });

  it("leaves a view that already shows the board alone, and an empty board free", () => {
    const v = { x: 10, y: 10, zoom: 1 };
    expect(clampView(v, bounds, size)).toBe(v);
    expect(clampView({ x: -9999, y: 0, zoom: 1 }, null, size).x).toBe(-9999);
  });

  it("pans just enough to show a card's head", () => {
    const view = { x: 0, y: 0, zoom: 1 };
    // already visible: no move
    expect(panToShow(view, { x: 100, y: 100, w: 288, h: 200 }, size)).toBe(view);
    // below the toolbar line: only up, and only as far as needed to show all of it
    const down = panToShow(view, { x: 100, y: 500, w: 288, h: 200 }, size);
    expect(down.x).toBe(0);
    expect(500 + down.y + 200).toBe(600 - 72);
    // a card taller than the view: just its head
    const tall = panToShow(view, { x: 100, y: 500, w: 288, h: 900 }, size);
    expect(500 + tall.y + 120).toBe(600 - 72);
    // off the left edge: only right
    const left = panToShow(view, { x: -400, y: 100, w: 288, h: 200 }, size);
    expect(left).toEqual({ x: 416, y: 0, zoom: 1 });
  });
});

describe("initialView", () => {
  it("opens where this device left the board, on any screen", () => {
    const saved = { x: 5, y: 6, zoom: 1.4 };
    expect(initialView(saved, true)).toBe(saved);
    expect(initialView(saved, false)).toBe(saved);
  });

  it("starts phones zoomed out enough to show more than one card", () => {
    expect(initialView(null, false)).toEqual(HOME);
    expect(initialView(null, true)).toEqual(PHONE_HOME);
    // 288px cards: a card and a half on a 375px phone
    expect(288 * PHONE_HOME.zoom).toBeLessThan(375 / 1.5);
  });
});

describe("isMouseWheel", () => {
  const long = Infinity;
  it("counts line and page deltas as a mouse wheel", () => {
    expect(isMouseWheel({ deltaMode: 1, deltaX: 0, deltaY: 3 }, long)).toBe(true);
    expect(isMouseWheel({ deltaMode: 2, deltaX: 0, deltaY: 1 }, 0)).toBe(true);
  });
  it("counts a big vertical-only pixel jump as a wheel notch", () => {
    expect(isMouseWheel({ deltaMode: 0, deltaX: 0, deltaY: 100 }, long)).toBe(true);
    expect(isMouseWheel({ deltaMode: 0, deltaX: 0, deltaY: -133.33 }, long)).toBe(true);
  });
  it("counts small or sideways deltas as a trackpad", () => {
    expect(isMouseWheel({ deltaMode: 0, deltaX: 0, deltaY: 4 }, long)).toBe(false);
    expect(isMouseWheel({ deltaMode: 0, deltaX: 2, deltaY: 120 }, long)).toBe(false);
  });
  it("keeps a trackpad flick's big deltas as a trackpad", () => {
    expect(isMouseWheel({ deltaMode: 0, deltaX: 0, deltaY: 140 }, 16)).toBe(false);
    expect(isMouseWheel({ deltaMode: 0, deltaX: 0, deltaY: 140 }, TRACKPAD_BURST_MS)).toBe(true);
  });
});
