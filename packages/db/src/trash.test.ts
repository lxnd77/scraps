import { describe, expect, it } from "vitest";
import { TRASH_DAYS, chunk, parseTrashRequest, purgeCutoff } from "./functions";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("purgeCutoff", () => {
  it("is exactly thirty days back", () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    expect(purgeCutoff(now)).toBe("2026-10-11T12:00:00.000Z");
    expect(TRASH_DAYS).toBe(30);
  });
});

describe("parseTrashRequest", () => {
  it("reads the three request shapes", () => {
    expect(parseTrashRequest({ purge: true })).toEqual({ kind: "purge" });
    expect(parseTrashRequest({ emptySpaceId: A })).toEqual({ kind: "empty", spaceId: A });
    expect(parseTrashRequest({ noteIds: [A, B, A] })).toEqual({ kind: "notes", noteIds: [A, B] });
  });

  it.each([
    null,
    "purge",
    [],
    {},
    { purge: "yes" },
    { noteIds: [] },
    { noteIds: ["nope"] },
    { noteIds: [A, 3] },
    { emptySpaceId: "x" },
    { noteIds: Array.from({ length: 101 }, () => A) },
  ])("rejects %j", (body) => {
    expect(parseTrashRequest(body)).toBeNull();
  });
});

describe("chunk", () => {
  it("splits into groups of at most size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
