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
import { StarterKit } from "@tiptap/starter-kit";

/** Name of the Yjs XML fragment that holds the document (SPEC 8.1). */
export const YDOC_FIELD = "default";

export const CALLOUT_COLORS = ["yellow", "lime", "pink", "blue", "lilac", "orange"] as const;
export type CalloutColor = (typeof CALLOUT_COLORS)[number];

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
  overrides?: Partial<Record<"taskItem" | "callout", AnyExtension>>;
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
    Highlight.configure({ multicolor: false }),
    BigText,
    options.overrides?.callout ?? Callout,
    TaskList,
    (options.overrides?.taskItem ?? ScrapsTaskItem).configure({ nested: false }),
    ChecklistShortcut,
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
