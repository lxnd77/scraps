import { describe, expect, it } from "vitest";
import { relativeFuture } from "./relativeTime";
import { avatarColorFor, peopleFromAwareness } from "./presence";

function awareness(states: Array<Record<string, unknown>>) {
  return {
    clientID: 1,
    getStates: () => new Map(states.map((s, i) => [i + 1, s])),
  };
}

describe("avatarColorFor", () => {
  it("is stable and always an accent", () => {
    const id = "0190aaaa-0000-7000-8000-000000000001";
    expect(avatarColorFor(id)).toBe(avatarColorFor(id));
    expect(["pink", "lime", "blue", "lilac", "orange", "yellow"]).toContain(avatarColorFor(id));
  });

  it("spreads different people across colours", () => {
    const colors = new Set(
      Array.from({ length: 40 }, (_, i) => avatarColorFor(`user-${i}-aaaa-bbbb`)),
    );
    expect(colors.size).toBeGreaterThan(3);
  });
});

describe("peopleFromAwareness", () => {
  it("lists each person once, yourself first, and skips clients with no user", () => {
    const people = peopleFromAwareness(
      awareness([
        { user: { userId: "maya", name: "maya" } },
        { user: { userId: "dev", name: "dev", sticker: "heart" } },
        { user: { userId: "maya", name: "maya" } }, // second tab
        {},
      ]),
      "dev",
    );
    expect(people.map((p) => p.userId)).toEqual(["dev", "maya"]);
    expect(people[0]?.sticker).toBe("heart");
  });

  it("falls back to a neutral name", () => {
    const [person] = peopleFromAwareness(awareness([{ user: { userId: "x" } }]), "me");
    expect(person?.name).toBe("someone");
  });
});

describe("relativeFuture", () => {
  const now = new Date("2026-10-10T12:00:00Z");
  it("reads like a countdown", () => {
    expect(relativeFuture("2026-10-10T11:59:00Z", now)).toBe("now");
    expect(relativeFuture("2026-10-10T12:00:30Z", now)).toBe("in a minute");
    expect(relativeFuture("2026-10-10T12:20:00Z", now)).toBe("in 20 min");
    expect(relativeFuture("2026-10-10T15:00:00Z", now)).toBe("in 3 h");
    expect(relativeFuture("2026-10-17T12:00:00Z", now)).toBe("in 7 d");
  });
});
