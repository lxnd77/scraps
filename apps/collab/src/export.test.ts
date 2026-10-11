import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { buildZip, frontMatter, noteFiles, uniqueName } from "./export.js";

describe("frontMatter", () => {
  it("writes JSON strings, which are valid YAML, and arrays", () => {
    const out = frontMatter({
      title: 'a "quoted": title',
      tags: ["travel", "goa trip"],
      space: "side quests",
      none: null,
    });
    expect(out).toBe(
      '---\ntitle: "a \\"quoted\\": title"\ntags: ["travel", "goa trip"]\nspace: "side quests"\n---\n',
    );
  });
});

describe("uniqueName", () => {
  it("slugs titles and keeps names unique in a folder", () => {
    const used = new Set<string>();
    expect(uniqueName("Book train tickets!", "11111111-aaaa", used)).toBe("book-train-tickets");
    expect(uniqueName("Book train tickets!", "22222222-bbbb", used)).toBe(
      "book-train-tickets-22222222",
    );
    expect(uniqueName("", "33333333-cccc", used)).toBe("untitled");
    expect(uniqueName("../../etc/passwd", "44444444-dddd", used)).toBe("etc-passwd");
  });
});

describe("noteFiles and buildZip", () => {
  it("puts each note under its space with front matter and a heading", () => {
    const files = noteFiles([
      {
        id: "n1-aaaaaaaa",
        title: "goa trip",
        kind: "list",
        spaceName: "Side Quests",
        tags: ["travel"],
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-02T00:00:00Z",
        markdown: "- [ ] tickets",
      },
      {
        id: "n2-bbbbbbbb",
        title: "",
        kind: "text",
        spaceName: "Side Quests",
        tags: [],
        createdAt: "2026-10-01T00:00:00Z",
        updatedAt: "2026-10-01T00:00:00Z",
        markdown: "loose thought",
      },
    ]);
    expect(Object.keys(files).sort()).toEqual([
      "notes/side-quests/goa-trip.md",
      "notes/side-quests/untitled.md",
    ]);
    const first = files["notes/side-quests/goa-trip.md"]!;
    expect(first).toContain('title: "goa trip"');
    expect(first).toContain("# goa trip\n\n- [ ] tickets");

    const zip = buildZip({ ...files, "media/a.webp": new Uint8Array([1, 2, 3]) });
    const entries = unzipSync(zip);
    expect(Object.keys(entries).sort()).toEqual([
      "media/a.webp",
      "notes/side-quests/goa-trip.md",
      "notes/side-quests/untitled.md",
    ]);
    expect(strFromU8(entries["notes/side-quests/untitled.md"]!)).toContain("loose thought");
  });
});
