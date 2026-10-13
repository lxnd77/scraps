// @vitest-environment jsdom
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import type { DecorationSet } from "@tiptap/pm/view";
import { describe, expect, it } from "vitest";
import { scrapsExtensions } from "../extensions";
import { afterTitlePlugin, afterTitlePos } from "./AfterTitle";

const schema = getSchema(scrapsExtensions());
const doc = (title: string, ...paragraphs: string[]) =>
  schema.nodeFromJSON({
    type: "doc",
    content: [
      { type: "title", content: title ? [{ type: "text", text: title }] : [] },
      ...paragraphs.map((text) => ({
        type: "paragraph",
        content: text ? [{ type: "text", text }] : [],
      })),
    ],
  });

describe("after-title slot", () => {
  it("sits right after the title, however long the title is", () => {
    // "<title>packing</title>" is 7 characters plus the node's open and close
    expect(afterTitlePos(doc("packing", "tent"))).toBe(9);
    expect(afterTitlePos(doc("", "tent"))).toBe(2);
    expect(afterTitlePos(doc("packing"))).toBe(9);
  });

  it("draws one widget there once a host exists, and nothing before", () => {
    const host = document.createElement("div");
    let current: HTMLElement | null = null;
    const plugin = afterTitlePlugin(() => current);
    const state = EditorState.create({ doc: doc("packing", "tent"), plugins: [plugin] });
    const decorations = () => plugin.props.decorations!.call(plugin, state) as DecorationSet;

    expect(decorations()!.find()).toHaveLength(0);
    current = host;
    const found = decorations()!.find();
    expect(found).toHaveLength(1);
    expect(found[0]!.from).toBe(9);
  });
});
