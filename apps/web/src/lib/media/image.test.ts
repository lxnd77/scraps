import { describe, expect, it } from "vitest";
import {
  MAX_EDGE,
  MAX_GIF_BYTES,
  MAX_INPUT_BYTES,
  averageColor,
  checkImageFile,
  fitWithin,
} from "./image";

describe("fitWithin", () => {
  it("scales the longer side down to 2048", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: MAX_EDGE, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: MAX_EDGE });
  });

  it("never scales up", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(2048, 2048)).toEqual({ width: 2048, height: 2048 });
  });

  it("keeps a thin strip at least one pixel", () => {
    expect(fitWithin(40000, 3).height).toBe(1);
  });
});

describe("checkImageFile", () => {
  it("accepts the supported types", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"]) {
      expect(checkImageFile({ type, size: 1000 })).toBeNull();
    }
  });

  it("recognises HEIC by extension when the type is empty", () => {
    expect(checkImageFile({ type: "", size: 1000, name: "IMG_0001.HEIC" })).toBeNull();
  });

  it("refuses other types, huge files and big gifs", () => {
    expect(checkImageFile({ type: "application/pdf", size: 10 })).toBe("type");
    expect(checkImageFile({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(checkImageFile({ type: "image/jpeg", size: MAX_INPUT_BYTES + 1 })).toBe("too_big");
    expect(checkImageFile({ type: "image/gif", size: MAX_GIF_BYTES + 1 })).toBe("too_big");
  });
});

describe("averageColor", () => {
  it("averages opaque pixels and ignores transparent ones", () => {
    const data = [255, 0, 0, 255, 0, 0, 255, 255, 9, 9, 9, 0];
    expect(averageColor(data)).toBe("#800080");
  });

  it("falls back to grey for an empty image", () => {
    expect(averageColor([])).toBe("#cccccc");
  });
});
