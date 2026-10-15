import { describe, expect, it } from "vitest";
import { splitHighlight } from "./en";
import { GREETINGS, greetingBand, pickGreeting } from "./greetings";

describe("greetingBand", () => {
  it("follows the clock", () => {
    expect(greetingBand(0)).toBe("late");
    expect(greetingBand(4)).toBe("late");
    expect(greetingBand(5)).toBe("morning");
    expect(greetingBand(11)).toBe("morning");
    expect(greetingBand(12)).toBe("afternoon");
    expect(greetingBand(16)).toBe("afternoon");
    expect(greetingBand(17)).toBe("evening");
    expect(greetingBand(20)).toBe("evening");
    expect(greetingBand(21)).toBe("night");
    expect(greetingBand(23)).toBe("night");
  });
});

describe("pickGreeting", () => {
  it("rolls across the whole pool, ends included", () => {
    const pool = GREETINGS.morning.board;
    expect(pickGreeting(9, "board", 0)).toBe(pool[0]);
    expect(pickGreeting(9, "board", 0.9999)).toBe(pool.at(-1));
    expect(pickGreeting(9, "board", 1)).toBe(pool.at(-1));
  });

  it("the 3am line is for 3am, not for any hour at night", () => {
    expect(pickGreeting(3, "board", 0)).toContain("3am");
    for (const line of GREETINGS.morning.board) expect(line).not.toContain("3am");
  });
});

describe("greeting copy", () => {
  const all = Object.values(GREETINGS).flatMap((band) => [...band.board, ...band.phone]);

  it("has several options per band and surface", () => {
    for (const band of Object.values(GREETINGS)) {
      expect(band.board.length).toBeGreaterThanOrEqual(4);
      expect(band.phone.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("is lowercase with exactly one highlight", () => {
    for (const line of all) {
      expect(line).toBe(line.toLowerCase());
      expect(splitHighlight(line).filter((part) => part.highlight)).toHaveLength(1);
    }
  });

  it("keeps phone lines short enough for a phone header", () => {
    for (const band of Object.values(GREETINGS)) {
      for (const line of band.phone)
        expect(line.replace(/\*\*/g, "").length).toBeLessThanOrEqual(44);
    }
  });
});
