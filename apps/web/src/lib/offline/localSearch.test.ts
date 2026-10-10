import type { NoteSummary } from "@scraps/db";
import { describe, expect, it } from "vitest";
import { searchLocal } from "./localSearch";

function note(over: Partial<NoteSummary>): NoteSummary {
  return {
    id: "id",
    spaceId: "s",
    title: "",
    previewText: "",
    kind: "text",
    color: "yellow",
    pinned: false,
    wordCount: 0,
    updatedAt: "2026-10-10T10:00:00Z",
    iconSticker: null,
    preview: {},
    ...over,
  };
}

const notes = [
  note({
    id: "a",
    title: "goa trip packing",
    previewText: "bring a hat",
    updatedAt: "2026-10-01T00:00:00Z",
  }),
  note({
    id: "b",
    title: "errands",
    kind: "list",
    previewText: "",
    preview: {
      checklist: {
        done: 0,
        total: 2,
        items: [
          { text: "buy stamps", done: false },
          { text: "post the parcel", done: false },
        ],
      },
    },
    updatedAt: "2026-10-05T00:00:00Z",
  }),
  note({
    id: "c",
    title: "random",
    previewText: "a thought about goa",
    updatedAt: "2026-10-09T00:00:00Z",
  }),
];

describe("searchLocal", () => {
  it("finds a word inside a checklist item and marks it", () => {
    const hits = searchLocal(notes, "stamps");
    expect(hits.map((h) => h.id)).toEqual(["b"]);
    expect(hits[0]?.snippet).toContain("<<stamps>>");
  });

  it("ranks title matches before body matches", () => {
    expect(searchLocal(notes, "goa").map((h) => h.id)).toEqual(["a", "c"]);
  });

  it("needs every word, in any order and case", () => {
    expect(searchLocal(notes, "PACKING goa").map((h) => h.id)).toEqual(["a"]);
    expect(searchLocal(notes, "goa parcel")).toEqual([]);
  });

  it("returns nothing for a blank query and ignores duplicate cards", () => {
    expect(searchLocal(notes, "   ")).toEqual([]);
    expect(searchLocal([...notes, notes[0]!], "goa")).toHaveLength(2);
  });
});
