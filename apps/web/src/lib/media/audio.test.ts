import { describe, expect, it } from "vitest";
import { blockPeak, formatClock, pickRecorderMime, reducePeaks } from "./audio";

describe("blockPeak", () => {
  it("is the largest absolute sample", () => {
    expect(blockPeak([0.1, -0.7, 0.3])).toBe(0.7);
    expect(blockPeak([])).toBe(0);
    expect(blockPeak([2])).toBe(1);
  });
});

describe("reducePeaks", () => {
  it("returns the requested number of bars normalised to 1", () => {
    const raw = Array.from({ length: 1000 }, (_, i) => (i % 100 === 0 ? 0.5 : 0.05));
    const bars = reducePeaks(raw, 64);
    expect(bars).toHaveLength(64);
    expect(Math.max(...bars)).toBe(1);
  });

  it("pads short input rather than failing", () => {
    expect(reducePeaks([0.2, 0.4], 4)).toHaveLength(4);
    expect(reducePeaks([], 8)).toEqual([]);
  });
});

describe("pickRecorderMime", () => {
  it("prefers webm and falls back to mp4 on Safari", () => {
    expect(pickRecorderMime((t) => t.startsWith("audio/webm"))).toEqual({
      mime: "audio/webm",
      ext: "webm",
    });
    expect(pickRecorderMime((t) => t === "audio/mp4")).toEqual({ mime: "audio/mp4", ext: "m4a" });
    expect(pickRecorderMime(() => false)).toBeNull();
  });
});

describe("formatClock", () => {
  it("formats minutes and seconds", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_000)).toBe("1:05");
    expect(formatClock(300_000)).toBe("5:00");
  });
});
