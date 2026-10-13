import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PmNode } from "@tiptap/pm/model";

export const afterTitleKey = new PluginKey("afterTitle");

/** Where the slot goes: right after the first node, which is always the title. */
export function afterTitlePos(doc: PmNode): number | null {
  const title = doc.firstChild;
  return title ? title.nodeSize : null;
}

/** The slot's plugin: one widget after the title, once `getHost` has an element to show. */
export function afterTitlePlugin(getHost: () => HTMLElement | null): Plugin {
  return new Plugin({
    key: afterTitleKey,
    props: {
      decorations(state) {
        const host = getHost();
        const pos = afterTitlePos(state.doc);
        if (!host || pos === null) return DecorationSet.empty;
        return DecorationSet.create(state.doc, [
          Decoration.widget(pos, () => host, {
            key: "after-title",
            // stays with the title as blocks come and go below it
            side: -1,
            ignoreSelection: true,
            stopEvent: () => true,
          }),
        ]);
      },
    },
  });
}

/**
 * A slot between the title and the first block for page furniture the caller renders (the
 * property chips). It is a widget, not content: nothing is written to the document, every client
 * places it locally, and the editor ignores events inside it so its own inputs and buttons work.
 */
export const AfterTitle = Extension.create<{ getHost: () => HTMLElement | null }>({
  name: "afterTitle",

  addOptions() {
    return { getHost: () => null };
  },

  addProseMirrorPlugins() {
    return [afterTitlePlugin(this.options.getHost)];
  },
});
