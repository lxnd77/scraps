import {
  Extension,
  Node,
  mergeAttributes,
  textblockTypeInputRule,
  wrappingInputRule,
  type AnyExtension,
} from "@tiptap/core";
import { Highlight } from "@tiptap/extension-highlight";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { UniqueID } from "@tiptap/extension-unique-id";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { StarterKit } from "@tiptap/starter-kit";

/** Name of the Yjs XML fragment that holds the document (SPEC 8.1). */
export const YDOC_FIELD = "default";

export const CALLOUT_COLORS = ["yellow", "lime", "pink", "blue", "lilac", "orange"] as const;
export type CalloutColor = (typeof CALLOUT_COLORS)[number];

/**
 * Highlights in the six accents. The colour is stored as its token name and painted by CSS with
 * the accent and its on-accent ink, so both themes keep AA contrast (coloured text on paper would
 * not). No colour is the classic yellow marker.
 */
export const ColorHighlight = Highlight.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => {
          const color = el.getAttribute("data-color");
          return color && (CALLOUT_COLORS as readonly string[]).includes(color) ? color : null;
        },
        renderHTML: (attrs) => (attrs.color ? { "data-color": attrs.color } : {}),
      },
    };
  },
});

/** Block nodes that carry a stable id for drag and, later, comments (SPEC 8.2). */
export const ID_NODE_TYPES = [
  "paragraph",
  "heading",
  "bigText",
  "callout",
  "taskList",
  "taskItem",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
  "table",
  "image",
  "moodBoard",
  "linkEmbed",
  "voiceMemo",
];

/**
 * Every document is `title block+`. The title is a real node, not "the first heading",
 * so the editor, cards and search all read it from one place (DECISIONS: dedicated title node).
 */
const Doc = Node.create({
  name: "doc",
  topNode: true,
  content: "title block+",
});

export const Title = Node.create({
  name: "title",
  content: "inline*",
  marks: "",
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: "h1[data-title]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["h1", mergeAttributes(HTMLAttributes, { "data-title": "", class: "scrap-title" }), 0];
  },
});

/**
 * An empty title is drawn with a CSS placeholder, which assistive tech cannot read, so an empty
 * heading would be announced as nothing. While it is empty the heading carries a label.
 */
const EmptyTitleLabel = Extension.create({
  name: "emptyTitleLabel",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("emptyTitleLabel"),
        props: {
          decorations(state) {
            const first = state.doc.firstChild;
            if (!first || first.type.name !== "title" || first.content.size > 0) return null;
            return DecorationSet.create(state.doc, [
              Decoration.node(0, first.nodeSize, { "aria-label": "untitled scrap" }),
            ]);
          },
        },
      }),
    ];
  },
});

/**
 * Backspace at the very start of the first block must not pull its text up into the title,
 * and Delete at the end of the title must not pull the first block down into it.
 */
const TitleGuard = Extension.create({
  name: "titleGuard",
  priority: 1000,

  addKeyboardShortcuts() {
    return {
      // Enter in the title moves to the first block instead of splitting the title. This runs at
      // the highest priority so the core keymap's splitBlock never sees the key.
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.parent.type.name !== "title") return false;
        return editor.commands.setTextSelection($from.after(1) + 1);
      },
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        if ($from.depth < 1 || $from.index(0) !== 1) return false;
        for (let d = 1; d <= $from.depth; d++) {
          if ($from.index(d) !== 0) return false;
        }
        return $from.parentOffset === 0;
      },
      Delete: ({ editor }) => {
        const { selection } = editor.state;
        if (!selection.empty) return false;
        const { $from } = selection;
        return (
          $from.parent.type.name === "title" && $from.parentOffset === $from.parent.content.size
        );
      },
    };
  },
});

/** Large pull-quote text. Makes the card a quote card. Markdown: `> `, slash: /big. */
export const BigText = Node.create({
  name: "bigText",
  group: "block",
  content: "inline*",
  defining: true,

  parseHTML() {
    return [{ tag: "p[data-big]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["p", mergeAttributes(HTMLAttributes, { "data-big": "", class: "scrap-big" }), 0];
  },

  addInputRules() {
    return [textblockTypeInputRule({ find: /^>\s$/, type: this.type })];
  },
});

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,

  addAttributes() {
    return {
      color: {
        default: "yellow" as CalloutColor,
        parseHTML: (el) => el.getAttribute("data-color") ?? "yellow",
        renderHTML: (attrs) => ({ "data-color": attrs.color }),
      },
      sticker: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-sticker"),
        renderHTML: (attrs) => (attrs.sticker ? { "data-sticker": attrs.sticker } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-callout": "", class: "scrap-callout" }),
      0,
    ];
  },
});

/** An attribute stored as JSON in a data-* attribute, so any value survives HTML round trips. */
function dataAttr<T>(name: string, fallback: T) {
  const key = `data-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
  return {
    default: fallback,
    parseHTML: (el: { getAttribute(name: string): string | null }) => {
      const raw = el.getAttribute(key);
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    renderHTML: (attrs: Record<string, unknown>) => {
      const value = attrs[name];
      return value === null || value === undefined || value === fallback
        ? {}
        : { [key]: JSON.stringify(value) };
    },
  };
}

export interface MoodImage {
  assetId: string;
  path: string;
  caption?: string;
  alt?: string;
}

/** A single picture. Storage path is `{noteId}/{assetId}.{ext}` (DECISIONS: media keyed by note). */
export const ImageBlock = Node.create({
  name: "image",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      assetId: dataAttr<string | null>("assetId", null),
      path: dataAttr<string | null>("path", null),
      caption: dataAttr("caption", ""),
      alt: dataAttr("alt", ""),
      polaroid: dataAttr("polaroid", false),
      width: dataAttr<number | null>("width", null),
      height: dataAttr<number | null>("height", null),
      color: dataAttr<string | null>("color", null),
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-image]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-image": "", class: "scrap-image" })];
  },
});

/** 2 to 9 pictures as polaroids with captions (SPEC 8.2). */
export const MoodBoard = Node.create({
  name: "moodBoard",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return { images: dataAttr<MoodImage[]>("images", []) };
  },

  parseHTML() {
    return [{ tag: "div[data-mood-board]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-mood-board": "", class: "scrap-mood" })];
  },
});

/** A pasted link as a card, or (mode `link`) kept as plain text elsewhere. */
export const LinkEmbed = Node.create({
  name: "linkEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url: dataAttr<string | null>("url", null),
      title: dataAttr<string | null>("title", null),
      description: dataAttr<string | null>("description", null),
      image: dataAttr<string | null>("image", null),
      domain: dataAttr<string | null>("domain", null),
      duration: dataAttr<number | null>("duration", null),
      mediaType: dataAttr<"article" | "video" | "maps">("mediaType", "article"),
      pin: dataAttr<{ lat: number; lng: number } | null>("pin", null),
    };
  },

  parseHTML() {
    return [{ tag: "div[data-link-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-link-embed": "", class: "scrap-link" })];
  },
});

/** A recorded memo. Audio lives in storage; the transcript is rendered from the asset (SPEC 9.4). */
export const VoiceMemo = Node.create({
  name: "voiceMemo",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      assetId: dataAttr<string | null>("assetId", null),
      path: dataAttr<string | null>("path", null),
      durationMs: dataAttr<number | null>("durationMs", null),
      peaks: dataAttr<number[]>("peaks", []),
      authorId: dataAttr<string | null>("authorId", null),
      authorName: dataAttr("authorName", ""),
    };
  },

  parseHTML() {
    return [{ tag: "div[data-voice-memo]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-voice-memo": "", class: "scrap-voice" }),
    ];
  },
});

/** An inline sticker, 48 to 96 px (SPEC 8.2). `id` is a StickerId from packages/ui. */
export const StickerNode = Node.create({
  name: "sticker",
  group: "inline",
  inline: true,
  atom: true,
  draggable: true,

  addAttributes() {
    return { id: dataAttr("id", "sparkle"), size: dataAttr("size", 64) };
  },

  parseHTML() {
    return [{ tag: "span[data-sticker-node]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-sticker-node": "", class: "scrap-sticker" }),
    ];
  },
});

/** Task item with an optional assignee (space member id) and due date. */
export const ScrapsTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      assigneeId: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-assignee"),
        renderHTML: (attrs) => (attrs.assigneeId ? { "data-assignee": attrs.assigneeId } : {}),
      },
      due: {
        default: null as string | null,
        parseHTML: (el) => el.getAttribute("data-due"),
        renderHTML: (attrs) => (attrs.due ? { "data-due": attrs.due } : {}),
      },
    };
  },
});

/** `[] ` (no space inside) starts a checklist, as the spec's markdown table says. */
const ChecklistShortcut = Extension.create({
  name: "checklistShortcut",

  addInputRules() {
    const taskItem = this.editor.schema.nodes.taskItem;
    if (!taskItem) return [];
    return [
      wrappingInputRule({
        find: /^\s*\[\]\s$/,
        type: taskItem,
        getAttributes: () => ({ checked: false }),
      }),
    ];
  },
});

export interface ScrapsExtensionOptions {
  /** Placeholder hints. Browser only; leave unset on the server. */
  placeholder?: { title: string; block: string };
  /** Replace a node extension with a client variant that adds a node view. */
  overrides?: Partial<
    Record<
      "taskItem" | "callout" | "image" | "moodBoard" | "linkEmbed" | "voiceMemo" | "sticker",
      AnyExtension
    >
  >;
}

/**
 * The one schema, used by the browser editor and the collab server's transformer
 * so previews and documents can never disagree (CLAUDE.md: shared schema package).
 */
export function scrapsExtensions(options: ScrapsExtensionOptions = {}): AnyExtension[] {
  const extensions: AnyExtension[] = [
    Doc,
    Title,
    TitleGuard,
    EmptyTitleLabel,
    StarterKit.configure({
      document: false,
      // the Collaboration extension owns undo and redo
      undoRedo: false,
      blockquote: false,
      underline: false,
      // Its trailing paragraph races the first sync and leaves a stray empty block in every new
      // note. The editor adds one on demand instead (click below the last block).
      trailingNode: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true },
    }),
    ColorHighlight.configure({ multicolor: true }),
    BigText,
    options.overrides?.callout ?? Callout,
    TaskList,
    (options.overrides?.taskItem ?? ScrapsTaskItem).configure({ nested: false }),
    ChecklistShortcut,
    options.overrides?.image ?? ImageBlock,
    options.overrides?.moodBoard ?? MoodBoard,
    options.overrides?.linkEmbed ?? LinkEmbed,
    options.overrides?.voiceMemo ?? VoiceMemo,
    options.overrides?.sticker ?? StickerNode,
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    UniqueID.configure({
      types: ID_NODE_TYPES,
      attributeName: "id",
      generateID: () => globalThis.crypto.randomUUID(),
    }),
  ];

  if (options.placeholder) {
    const { title, block } = options.placeholder;
    extensions.push(
      Placeholder.configure({
        showOnlyCurrent: false,
        includeChildren: false,
        placeholder: ({ node, hasAnchor }) => {
          if (node.type.name === "title") return title;
          return hasAnchor ? block : "";
        },
      }),
    );
  }

  return extensions;
}
