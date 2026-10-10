import { describe, expect, it } from "vitest";
import { boardGreetingKey, en, greetingPeriod, splitHighlight, t } from "./en";

describe("t()", () => {
  it("returns the daylight string by default", () => {
    expect(t("capture.save")).toBe("save it");
  });

  it("returns the night string when the resolved theme is midnight", () => {
    expect(t("capture.save", {}, { night: true })).toBe("save it, sleep");
    expect(t("empty.board", {}, { night: true })).toBe("nothing yet. the night is young.");
  });

  it("fills variables and leaves unknown ones alone", () => {
    expect(t("streak.title", { n: 12 }, { night: true })).toBe("night owl streak · 12 nights");
    expect(t("board.kicker", { weekday: "fri" })).toBe("fri · {space}");
  });

  it("uses the same string in both themes where the spec does", () => {
    expect(t("offline.chip")).toBe(t("offline.chip", {}, { night: true }));
  });
});

describe("greetings", () => {
  it("picks the period by hour", () => {
    expect(greetingPeriod(0)).toBe("morning");
    expect(greetingPeriod(11)).toBe("morning");
    expect(greetingPeriod(12)).toBe("afternoon");
    expect(greetingPeriod(17)).toBe("afternoon");
    expect(greetingPeriod(18)).toBe("evening");
    expect(greetingPeriod(23)).toBe("evening");
  });

  it("maps the period to its copy key", () => {
    expect(boardGreetingKey(9)).toBe("board.greeting");
    expect(boardGreetingKey(14)).toBe("board.greeting.afternoon");
    expect(boardGreetingKey(20)).toBe("board.greeting.evening");
  });

  it("splits highlight markers", () => {
    expect(splitHighlight("gm. what's the **mess** today?")).toEqual([
      { text: "gm. what's the ", highlight: false },
      { text: "mess", highlight: true },
      { text: " today?", highlight: false },
    ]);
  });
});

describe("voice rules", () => {
  const strings = Object.values(en).flatMap((pair) => [pair.day, pair.night]);

  it("has no em-dashes in UI copy", () => {
    for (const s of strings) expect(s).not.toContain("—");
  });

  it("is lowercase apart from placeholders", () => {
    for (const s of strings) {
      const withoutVars = s.replace(/\{\w+\}/g, "");
      expect(withoutVars).toBe(withoutVars.toLowerCase());
    }
  });
});
