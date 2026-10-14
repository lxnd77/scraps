import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import { Sticker } from "@scraps/ui";
import { Extension, type Editor } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { Suggestion, type SuggestionProps } from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { SlashMenu, type SlashMenuHandle } from "./SlashMenu";
import { filterSlashItems, type SlashItem } from "./slashItems";
import { stickerPlacer } from "./StickerLayer";

interface CommandConfig {
  name: string;
  key: string;
  char: string;
  items: (query: string) => SlashItem[];
  /** only after whitespace or at the start of a line, so "10:30" never opens it */
  startOfWord?: boolean;
}

function createCommand({ name, key, char, items, startOfWord }: CommandConfig) {
  const pluginKey = new PluginKey(key);
  return Extension.create({
    name,

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashItem, SlashItem>({
          editor: this.editor,
          pluginKey,
          char,
          allowedPrefixes: startOfWord ? [" "] : undefined,
          allowSpaces: false,
          startOfLine: false,
          allow: ({ state, range }) => {
            const $from = state.doc.resolve(range.from);
            const parent = $from.parent;
            return parent.type.name !== "title" && !parent.type.spec.code;
          },
          items: ({ query }) => items(query),
          command: ({ editor, range, props }) => props.run(editor, range),
          render: () => {
            let renderer: ReactRenderer<SlashMenuHandle> | null = null;
            let host: HTMLElement | null = null;
            let editorRef: Editor | null = null;
            const listId = `${name}-${Math.random().toString(36).slice(2, 8)}`;

            const place = (props: SuggestionProps<SlashItem, SlashItem>) => {
              const rect = props.clientRect?.();
              if (!rect || !host) return;
              const reference = { getBoundingClientRect: () => rect };
              void computePosition(reference, host, {
                placement: "bottom-start",
                middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
              }).then(({ x, y }) => {
                if (host) Object.assign(host.style, { left: `${x}px`, top: `${y}px` });
              });
            };

            const point = (id: string | null) => {
              const dom = editorRef?.view.dom;
              if (!dom) return;
              if (id) {
                dom.setAttribute("aria-controls", listId);
                dom.setAttribute("aria-activedescendant", id);
                dom.setAttribute("aria-expanded", "true");
              } else {
                dom.removeAttribute("aria-controls");
                dom.removeAttribute("aria-activedescendant");
                dom.removeAttribute("aria-expanded");
              }
            };

            return {
              onStart: (props) => {
                editorRef = props.editor;
                renderer = new ReactRenderer(SlashMenu, {
                  editor: props.editor,
                  props: { items: props.items, command: props.command, listId, onActive: point },
                });
                host = document.createElement("div");
                host.className = "scrap-slash-host";
                host.style.position = "absolute";
                host.style.zIndex = "60";
                host.appendChild(renderer.element);
                document.body.appendChild(host);
                place(props);
              },
              onUpdate: (props) => {
                renderer?.updateProps({
                  items: props.items,
                  command: props.command,
                  listId,
                  onActive: point,
                });
                place(props);
              },
              onKeyDown: ({ event }) => {
                if (event.key === "Escape") return false; // Suggestion closes itself
                return renderer?.ref?.onKeyDown(event) ?? false;
              },
              onExit: () => {
                point(null);
                renderer?.destroy();
                host?.remove();
                renderer = null;
                host = null;
              },
            };
          },
        }),
      ];
    },
  });
}

/** Typing "/" opens the "drop a block" menu. Not in the title, not inside code. */
export const SlashCommand = createCommand({
  name: "slashCommand",
  key: "scrapsSlashMenu",
  char: "/",
  items: (query) => filterSlashItems(query),
});

export const STICKER_PACK = [
  "smiley",
  "sleepy-moon",
  "heart",
  "sparkle",
  "lightning",
  "flower",
  "speech-bubble",
  "planet",
  "zzz",
  "sun",
] as const;

/** Typing ":" after a space or at the start of a line offers the sticker pack. */
export const StickerCommand = createCommand({
  name: "stickerCommand",
  key: "scrapsStickerMenu",
  char: ":",
  startOfWord: true,
  items: (query) => {
    const q = query.trim().toLowerCase();
    return STICKER_PACK.filter((id) => !q || id.includes(q)).map((id) => ({
      id,
      name: id,
      description: "sticker",
      shortcut: ":" + id,
      keywords: [],
      icon: <Sticker id={id} size={28} />,
      run: (editor, range) => {
        // in the browser the sticker floats over the scrap by the caret, like every other sticker
        const place = stickerPlacer(editor);
        if (place) {
          const at = editor.view.coordsAtPos(range.from);
          editor.chain().focus().deleteRange(range).run();
          place(id, { x: at.left, y: at.top });
          return;
        }
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent({ type: "sticker", attrs: { id, size: 64 } })
          .run();
      },
    }));
  },
});
