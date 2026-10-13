import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { contentToYdoc, ydocToContent } from "./doc";
import { initialContent } from "./initial";
import { putSticker, readStickers, removeSticker, STICKER_MAP } from "./stickers";

describe("floating stickers", () => {
  it("round-trips through a Yjs update and leaves the content alone", () => {
    const doc = contentToYdoc(initialContent("text", { title: "t", text: "hello" }));
    const before = ydocToContent(doc);
    putSticker(doc, "a", { sticker: "heart", x: 0.4, y: 120, scale: 1.2, rotation: 15 });

    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(doc));
    expect(readStickers(copy)).toEqual([
      ["a", { sticker: "heart", x: 0.4, y: 120, scale: 1.2, rotation: 15 }],
    ]);
    expect(ydocToContent(copy)).toEqual(before);
  });

  it("clamps what it stores and skips what it cannot read", () => {
    const doc = new Y.Doc();
    putSticker(doc, "a", { sticker: "sparkle", x: 4, y: -10, scale: 9, rotation: 400 });
    doc.getMap(STICKER_MAP).set("junk", { sticker: "<script>", x: 0, y: 0, scale: 1, rotation: 0 });
    expect(readStickers(doc)).toEqual([
      ["a", { sticker: "sparkle", x: 1, y: 0, scale: 3, rotation: 180 }],
    ]);
    removeSticker(doc, "a");
    expect(readStickers(doc)).toEqual([]);
  });
});
