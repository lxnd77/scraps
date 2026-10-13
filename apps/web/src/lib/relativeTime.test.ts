import { describe, expect, it } from "vitest";
import { dayLabel, relativeTime } from "./relativeTime";

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

describe("dayLabel", () => {
  const today = new Date(2026, 9, 13, 23, 30);
  it("reads a date input's day as a short lowercase label", () => {
    expect(dayLabel("2026-10-17", today)).toBe("sat 17 oct");
    expect(dayLabel("2026-01-01", today)).toBe("thu 1 jan");
  });

  it("adds the year only when it is not this year", () => {
    expect(dayLabel("2027-02-14", today)).toBe("sun 14 feb 2027");
  });

  it("never shifts the day, and leaves anything else as it is", () => {
    // a UTC parse of "2026-10-13" would land on the 12th west of Greenwich
    expect(dayLabel("2026-10-13", today)).toBe("tue 13 oct");
    expect(dayLabel("soon", today)).toBe("soon");
  });
});
