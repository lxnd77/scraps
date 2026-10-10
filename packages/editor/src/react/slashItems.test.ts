// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";
import { scrapsExtensions } from "../extensions";
import { initialContent } from "../initial";
import { SLASH_ITEMS, filterSlashItems } from "./slashItems";

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
};

describe("slash menu items", () => {
  it("covers every text block in SPEC 8.2", () => {
    expect(SLASH_ITEMS.map((i) => i.id).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(SLASH_ITEMS.map((item) => [item.id, item] as const))(
    "%s inserts its block and removes the slash",
    (id, item) => {
      const { editor: e, range } = editorWithSlash();
      item.run(e, range);
      expect(blocks(e), id).toContain(EXPECTED[id]);
      expect(e.getText()).not.toContain("/");
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
