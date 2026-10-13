import { describe, expect, it } from "vitest";
import { clampScale, handleTransform, wrapDegrees } from "./FreeSticker";

describe("free sticker transforms", () => {
  it("wraps angles into -180..180", () => {
    expect(wrapDegrees(190)).toBe(-170);
    expect(wrapDegrees(-190)).toBe(170);
    expect(wrapDegrees(360)).toBe(0);
  });

  it("clamps scale", () => {
    expect(clampScale(9)).toBe(3);
    expect(clampScale(0.1)).toBe(0.5);
  });

  it("turns and grows with the corner handle", () => {
    const center = { x: 0, y: 0 };
    // a quarter turn clockwise, twice as far out
    const out = handleTransform(
      center,
      { x: 10, y: 0 },
      { x: 0, y: 20 },
      { scale: 1, rotation: 0 },
    );
    expect(out).toEqual({ rotation: 90, scale: 2 });
    const back = handleTransform(
      center,
      { x: 10, y: 0 },
      { x: 10, y: 0 },
      { scale: 1.5, rotation: 30 },
    );
    expect(back).toEqual({ rotation: 30, scale: 1.5 });
  });
});
