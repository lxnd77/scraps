import { describe, expect, it } from "vitest";
import { uuidv7 } from "./uuid";

describe("uuidv7", () => {
  it("is a valid version 7 uuid", () => {
    expect(uuidv7()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("puts the timestamp first, so ids sort by creation time", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    const c = uuidv7(1_800_000_000_000);
    expect([c, b, a].sort()).toEqual([a, b, c]);
    expect(a.replace("-", "").slice(0, 12)).toBe(
      (1_700_000_000_000).toString(16).padStart(12, "0"),
    );
  });

  it("does not repeat", () => {
    const ids = new Set(Array.from({ length: 500 }, () => uuidv7()));
    expect(ids.size).toBe(500);
  });
});
