import type { Editor, Range } from "@tiptap/core";
import {
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Images,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Mic,
  Minus,
  Quote,
  Smile,
  StickyNote,
  Table2,
  Type,
} from "lucide-react";
import type { ReactNode } from "react";

export interface SlashItem {
  id: string;
  name: string;
  description: string;
  /** mono hint: the markdown shortcut or slash keyword */
  shortcut: string;
  keywords: string[];
  icon: ReactNode;
  run: (editor: Editor, range: Range) => void;
}

const icon = (Icon: typeof Type) => <Icon size={20} strokeWidth={2.4} aria-hidden="true" />;

/** The "drop a block" menu (SPEC 6.3). */
export const SLASH_ITEMS: SlashItem[] = [
  {
    id: "text",
    name: "text",
    description: "just start typing",
    shortcut: "/text",
    keywords: ["paragraph", "plain", "p"],
    icon: icon(Type),
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    id: "h1",
    name: "big heading",
    description: "the loud one",
    shortcut: "#",
    keywords: ["heading", "h1", "title"],
    icon: icon(Heading1),
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    name: "heading",
    description: "a section title",
    shortcut: "##",
    keywords: ["heading", "h2", "section"],
    icon: icon(Heading2),
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    name: "small heading",
    description: "a quieter title",
    shortcut: "###",
    keywords: ["heading", "h3", "sub"],
    icon: icon(Heading3),
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run(),
  },
  {
    id: "checklist",
    name: "checklist",
    description: "things to tick off",
    shortcut: "[]",
    keywords: ["todo", "task", "check", "list"],
    icon: icon(ListChecks),
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    id: "bullets",
    name: "bullets",
    description: "a plain list",
    shortcut: "-",
    keywords: ["bullet", "list", "ul"],
    icon: icon(List),
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    id: "numbers",
    name: "numbered",
    description: "a list in order",
    shortcut: "1.",
    keywords: ["number", "ordered", "list", "ol"],
    icon: icon(ListOrdered),
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    id: "callout",
    name: "callout",
    description: "a loud little box",
    shortcut: "/callout",
    keywords: ["note", "box", "highlight", "tip"],
    icon: icon(StickyNote),
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({
          type: "callout",
          attrs: { color: "yellow" },
          content: [{ type: "paragraph" }],
        })
        .run(),
  },
  {
    id: "big",
    name: "big text",
    description: "make a statement",
    shortcut: ">",
    keywords: ["quote", "pull", "large"],
    icon: icon(Quote),
    run: (editor, range) => editor.chain().focus().deleteRange(range).setNode("bigText").run(),
  },
  {
    id: "divider",
    name: "divider",
    description: "a line between things",
    shortcut: "---",
    keywords: ["line", "rule", "hr", "separator"],
    icon: icon(Minus),
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
  {
    id: "code",
    name: "code",
    description: "mono, no colours",
    shortcut: "```",
    keywords: ["snippet", "pre"],
    icon: icon(Code2),
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    id: "image",
    name: "pic",
    description: "one picture, with a caption",
    shortcut: "/img",
    keywords: ["image", "photo", "picture", "img"],
    icon: icon(ImageIcon),
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: "image" }).run(),
  },
  {
    id: "mood",
    name: "mood board",
    description: "a pile of polaroids",
    shortcut: "/mood",
    keywords: ["pics", "gallery", "moodboard", "photos"],
    icon: icon(Images),
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "moodBoard", attrs: { images: [] } })
        .run(),
  },
  {
    id: "link",
    name: "link",
    description: "unfurl a web address",
    shortcut: "/url",
    keywords: ["url", "embed", "website", "bookmark"],
    icon: icon(Link2),
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: "linkEmbed" }).run(),
  },
  {
    id: "voice",
    name: "voice memo",
    description: "talk it out, up to 5 minutes",
    shortcut: "/rec",
    keywords: ["record", "audio", "mic", "voice"],
    icon: icon(Mic),
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).insertContent({ type: "voiceMemo" }).run(),
  },
  {
    id: "sticker",
    name: "sticker",
    description: "a loud little sticker",
    shortcut: ":",
    keywords: ["emoji", "stamp", "decor"],
    icon: icon(Smile),
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent({ type: "sticker", attrs: { id: "sparkle", size: 64 } })
        .run(),
  },
  {
    id: "table",
    name: "table",
    description: "rows and columns",
    shortcut: "/tbl",
    keywords: ["grid", "tbl", "rows"],
    icon: icon(Table2),
    run: (editor, range) =>
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run(),
  },
];

/** Type-to-filter: name and keywords, prefix matches first. */
export function filterSlashItems(query: string, items: SlashItem[] = SLASH_ITEMS): SlashItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const scored = items
    .map((item) => {
      const haystack = [item.name, item.id, ...item.keywords].map((s) => s.toLowerCase());
      if (haystack.some((s) => s.startsWith(q))) return { item, score: 0 };
      if (haystack.some((s) => s.includes(q))) return { item, score: 1 };
      return null;
    })
    .filter((entry): entry is { item: SlashItem; score: number } => entry !== null);
  return scored.sort((a, b) => a.score - b.score).map((entry) => entry.item);
}
