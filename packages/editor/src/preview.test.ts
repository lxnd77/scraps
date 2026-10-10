import { describe, expect, it } from "vitest";
import { fixtures } from "./fixtures";
import { extractPreview } from "./preview";

describe("extractPreview", () => {
  it("empty note is an untitled text note", () => {
    expect(extractPreview(fixtures.empty)).toEqual({
      title: "",
      previewText: "",
      kind: "text",
      wordCount: 0,
      searchText: "",
      preview: {},
    });
  });

  it("text note: title, preview text, word count", () => {
    const result = extractPreview(fixtures.plainText);
    expect(result.title).toBe("is the moon a notification light");
    expect(result.kind).toBe("text");
    expect(result.previewText).toBe("made total sense at 3am. revisit in daylight.");
    // 6 title words + 5 + 3 body words
    expect(result.wordCount).toBe(14);
    expect(result.preview).toEqual({});
  });

  it("checklist-led note is a list with done/total and the first four items", () => {
    const result = extractPreview(fixtures.checklist);
    expect(result.kind).toBe("list");
    expect(result.preview.checklist).toEqual({
      done: 1,
      total: 5,
      items: [
        { text: "drink a glass of water", done: true },
        { text: "plug in phone", done: false },
        { text: "stop doomscrolling", done: false },
        { text: "close your eyes", done: false },
      ],
    });
    expect(result.searchText).toContain("plug in phone");
    expect(result.searchText).toContain("sleep");
  });

  it("quote note: big text becomes the quote and the kind", () => {
    const result = extractPreview(fixtures.quote);
    expect(result.kind).toBe("quote");
    expect(result.preview.quote).toBe("go to sleep.");
  });

  it("a blank paragraph before the list does not change the kind", () => {
    expect(extractPreview(fixtures.blankThenList).kind).toBe("list");
  });

  it("the first meaningful block decides: text then list stays text", () => {
    const result = extractPreview(fixtures.textThenList);
    expect(result.kind).toBe("text");
    // the checklist is still summarised for the card footer
    expect(result.preview.checklist?.total).toBe(1);
  });

  it("mixed content: callout, table and code all feed preview text and search", () => {
    const result = extractPreview({
      type: "doc",
      content: [
        ...fixtures.callout.content!,
        ...fixtures.table.content!.slice(1),
        ...fixtures.code.content!.slice(1),
      ],
    });
    expect(result.previewText).toContain("remember the charger");
    expect(result.previewText).toContain("noodles");
    expect(result.previewText).toContain("const sleep = never;");
    expect(result.searchText).toContain("2am");
  });

  it("truncates long titles and previews", () => {
    const long = "word ".repeat(200).trim();
    const result = extractPreview({
      type: "doc",
      content: [
        { type: "title", content: [{ type: "text", text: long }] },
        { type: "paragraph", content: [{ type: "text", text: long }] },
      ],
    });
    expect(result.title.length).toBeLessThanOrEqual(120);
    expect(result.previewText.length).toBeLessThanOrEqual(280);
    expect(result.wordCount).toBe(400);
  });

  it("derives kinds for the Phase 4 media blocks so the extractor needs no change then", () => {
    const base = (block: object) =>
      extractPreview({
        type: "doc",
        content: [{ type: "title" }, block as never],
      });
    expect(base({ type: "image", attrs: { assetId: "a1" } })).toMatchObject({
      kind: "pic",
      preview: { images: ["a1"] },
    });
    expect(
      base({ type: "moodBoard", attrs: { images: [{ assetId: "a" }, { assetId: "b" }] } }).preview
        .images,
    ).toEqual(["a", "b"]);
    expect(
      base({
        type: "linkEmbed",
        attrs: { url: "https://www.youtube.com/watch?v=1", title: "lofi" },
      }),
    ).toMatchObject({
      kind: "link",
      preview: { link: { domain: "youtube.com", title: "lofi" } },
      searchText: "lofi",
    });
    expect(base({ type: "voiceMemo", attrs: { assetId: "v1", durationMs: 66000 } })).toMatchObject({
      kind: "voice",
      preview: { voice: { assetId: "v1", durationMs: 66000 } },
    });
  });
});
