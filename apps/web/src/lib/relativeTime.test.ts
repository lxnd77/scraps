import { describe, expect, it } from "vitest";
import { relativeTime } from "./relativeTime";

const now = new Date("2026-10-10T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000);

describe("relativeTime", () => {
  it.each([
    [10, "just now"],
    [44, "just now"],
    [120, "2 min ago"],
    [59 * 60, "59 min ago"],
    [3 * 3600, "3 h ago"],
    [23 * 3600, "23 h ago"],
    [24 * 3600, "yesterday"],
    [5 * 86400, "5 d ago"],
  ])("%s seconds is %s", (seconds, expected) => {
    expect(relativeTime(ago(seconds), now)).toBe(expected);
  });

  it("falls back to a short date after a month", () => {
    expect(relativeTime("2026-08-01T00:00:00Z", now)).toBe("aug 1");
  });
});
