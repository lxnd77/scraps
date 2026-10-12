// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { scrapsExtensions } from "../extensions";
import { initialContent } from "../initial";
import { SLASH_ITEMS, filterSlashItems, insertBlock } from "./slashItems";

let editor: Editor | undefined;

afterEach(() => {
  editor?.destroy();
  editor = undefined;
});

/** A real editor on the shared schema, with the caret in the first body block and "/" typed. */
function editorWithSlash() {
  editor = new Editor({
    extensions: scrapsExtensions(),
    content: initialContent("text", { title: "t" }),
  });
  // body paragraph sits right after the title node
  const titleSize = editor.state.doc.firstChild!.nodeSize;
  const from = titleSize + 1;
  editor.commands.insertContentAt(from, "/");
  editor.commands.setTextSelection(from + 1);
  return { editor, range: { from, to: from + 1 } };
}

/** Names of the body blocks (everything after the title). */
function blocks(e: Editor): string[] {
  const names: string[] = [];
  e.state.doc.forEach((node, _offset, index) => {
    if (index > 0) names.push(node.type.name);
  });
  return names;
}

const EXPECTED: Record<string, string> = {
  text: "paragraph",
  h1: "heading",
  h2: "heading",
  h3: "heading",
  checklist: "taskList",
  bullets: "bulletList",
  numbers: "orderedList",
  callout: "callout",
  big: "bigText",
  divider: "horizontalRule",
  code: "codeBlock",
  table: "table",
  image: "image",
  mood: "moodBoard",
  link: "linkEmbed",
  voice: "voiceMemo",
  // an inline sticker lives inside a paragraph
  sticker: "paragraph",
};

describe("slash menu items", () => {
  it("covers every block in SPEC 8.2", () => {
    expect(SLASH_ITEMS.map((i) => i.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(SLASH_ITEMS.map((item) => [item.id, item] as const))(
    "%s inserts its block and removes the slash",
    (id, item) => {
      const { editor: e, range } = editorWithSlash();
      item.run(e, range);
      expect(blocks(e), id).toContain(EXPECTED[id]);
      expect(e.getText()).not.toContain("/");
      if (id === "sticker") expect(JSON.stringify(e.getJSON())).toContain('"type":"sticker"');
      // whatever was inserted, the document still satisfies the schema
      expect(() => e.state.doc.check()).not.toThrow();
    },
  );

  it("heading levels are right", () => {
    for (const [id, level] of [
      ["h1", 1],
      ["h2", 2],
      ["h3", 3],
    ] as const) {
      const { editor: e, range } = editorWithSlash();
      SLASH_ITEMS.find((i) => i.id === id)!.run(e, range);
      const heading = e.state.doc.child(1);
      expect(heading.type.name).toBe("heading");
      expect(heading.attrs.level).toBe(level);
      e.destroy();
      editor = undefined;
    }
  });
});

describe("filterSlashItems", () => {
  it("returns everything for an empty query", () => {
    expect(filterSlashItems("")).toHaveLength(SLASH_ITEMS.length);
  });

  it("matches names and keywords, prefix matches first", () => {
    const ids = filterSlashItems("head").map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["h1", "h2", "h3"]));
    expect(filterSlashItems("todo").map((i) => i.id)).toEqual(["checklist"]);
    expect(filterSlashItems("zzzz")).toEqual([]);
  });
});

describe("insertBlock (the + picker)", () => {
  const item = (id: string) => SLASH_ITEMS.find((i) => i.id === id)!;

  function fresh(content = initialContent("text", { title: "t" })) {
    editor = new Editor({ extensions: scrapsExtensions(), content });
    return editor;
  }

  it("fills the empty paragraph the caret is in", () => {
    const e = fresh();
    const before = blocks(e).length;
    e.commands.setTextSelection(e.state.doc.firstChild!.nodeSize + 1);
    insertBlock(e, item("checklist"), "caret");
    expect(blocks(e)).toHaveLength(before);
    expect(blocks(e)[0]).toBe("taskList");
  });

  it("opens a new block under a block that has text", () => {
    const e = fresh();
    const from = e.state.doc.firstChild!.nodeSize + 1;
    e.commands.insertContentAt(from, "hello");
    e.commands.setTextSelection(from + 2);
    insertBlock(e, item("divider"), "caret");
    expect(blocks(e).slice(0, 2)).toEqual(["paragraph", "horizontalRule"]);
    expect(e.state.doc.child(1).textContent).toBe("hello");
  });

  it("never turns the title into a block", () => {
    const e = fresh();
    e.commands.setTextSelection(1);
    insertBlock(e, item("h1"), "caret");
    expect(e.state.doc.firstChild!.type.name).toBe("title");
    expect(blocks(e)[0]).toBe("heading");
  });

  it("adds at the end of the scrap", () => {
    const e = fresh();
    const from = e.state.doc.firstChild!.nodeSize + 1;
    e.commands.insertContentAt(from, "first");
    e.commands.setTextSelection(1);
    insertBlock(e, item("callout"), "end");
    expect(blocks(e).at(-1)).toBe("callout");
    expect(e.state.doc.child(1).textContent).toBe("first");
  });
});
