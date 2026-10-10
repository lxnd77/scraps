import { getSchema } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { contentToYdoc, ydocToContent } from "./doc";
import { ID_NODE_TYPES, scrapsExtensions } from "./extensions";
import { fixtures } from "./fixtures";
import { initialContent } from "./initial";

describe("schema", () => {
  const schema = getSchema(scrapsExtensions());

  it("builds on the server with no DOM", () => {
    expect(typeof window).toBe("undefined");
    expect(schema.topNodeType.name).toBe("doc");
  });

  it("requires a title first", () => {
    expect(schema.topNodeType.spec.content).toBe("title block+");
    const bad = schema.nodeFromJSON({ type: "doc", content: [{ type: "paragraph" }] });
    expect(() => bad.check()).toThrow();
    const good = schema.nodeFromJSON(initialContent("text"));
    expect(() => good.check()).not.toThrow();
  });

  it("defines every Phase 2 block", () => {
    for (const name of [
      "title",
      "paragraph",
      "heading",
      "bulletList",
      "orderedList",
      "taskList",
      "taskItem",
      "callout",
      "bigText",
      "horizontalRule",
      "codeBlock",
      "table",
    ]) {
      expect(schema.nodes[name], name).toBeDefined();
    }
    for (const mark of ["bold", "italic", "strike", "code", "highlight", "link"]) {
      expect(schema.marks[mark], mark).toBeDefined();
    }
  });

  it("gives every block type an id attribute", () => {
    for (const name of ID_NODE_TYPES) {
      expect(schema.nodes[name]?.hasRequiredAttrs(), name).toBe(false);
      expect(Object.keys(schema.nodes[name]!.spec.attrs ?? {}), name).toContain("id");
    }
  });

  it("carries assignee and due on task items, and colour and sticker on callouts", () => {
    expect(Object.keys(schema.nodes.taskItem!.spec.attrs ?? {})).toEqual(
      expect.arrayContaining(["checked", "assigneeId", "due"]),
    );
    expect(Object.keys(schema.nodes.callout!.spec.attrs ?? {})).toEqual(
      expect.arrayContaining(["color", "sticker"]),
    );
  });
});

// Yjs stores attributes as XML attributes, so a null attribute and a missing one are the same
// thing. Compare with nulls stripped from both sides.
function withoutNullAttrs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(withoutNullAttrs);
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "attrs" && value && typeof value === "object") {
        const attrs = Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null));
        if (Object.keys(attrs).length > 0) out.attrs = attrs;
      } else {
        out[key] = withoutNullAttrs(value);
      }
    }
    return out;
  }
  return node;
}

describe("JSON to Yjs to JSON is lossless", () => {
  for (const [name, json] of Object.entries(fixtures)) {
    it(name, () => {
      const ydoc = contentToYdoc(json);
      expect(withoutNullAttrs(ydocToContent(ydoc))).toEqual(withoutNullAttrs(json));
    });
  }

  it("survives a binary state round trip (what the database stores)", () => {
    const original = contentToYdoc(fixtures.checklist);
    const restored = new Y.Doc();
    Y.applyUpdate(restored, Y.encodeStateAsUpdate(original));
    expect(withoutNullAttrs(ydocToContent(restored))).toEqual(withoutNullAttrs(fixtures.checklist));
  });
});

describe("initial documents", () => {
  it.each(["text", "list", "quote"] as const)("%s start is a valid document", (start) => {
    const schema = getSchema(scrapsExtensions());
    const node = schema.nodeFromJSON(initialContent(start, { title: "hi", text: "first thought" }));
    expect(() => node.check()).not.toThrow();
    expect(node.firstChild?.type.name).toBe("title");
    expect(node.textContent).toContain("first thought");
  });
});
