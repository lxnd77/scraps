"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Image as ImageIcon, Link2, ListChecks, Mic, Plus, Smile, Type } from "lucide-react";
import type { ReactNode } from "react";
import { insertBlock, SLASH_ITEMS } from "./slashItems";

interface ToolbarButton {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  run: () => void;
}

const icon = (Icon: typeof Type) => <Icon size={24} strokeWidth={2.4} aria-hidden="true" />;

/** Puts one of the slash menu's blocks at the caret, as the "+" picker would. */
function add(editor: Editor, id: string) {
  const item = SLASH_ITEMS.find((i) => i.id === id);
  if (item) insertBlock(editor, item, "caret");
}

/**
 * Floating block toolbar for touch (SPEC 6.5), replacing the slash menu on phones: the common
 * blocks one tap away, and "+" for the full list. Buttons keep the editor focused so the keyboard
 * stays up.
 */
export function BlockToolbar({ editor, onMore }: { editor: Editor; onMore: () => void }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      checklist: e.isActive("taskList"),
      text: e.isActive("paragraph"),
    }),
  });

  const buttons: ToolbarButton[] = [
    { id: "more", label: "add a block", icon: icon(Plus), run: onMore },
    {
      id: "text",
      label: "text",
      icon: icon(Type),
      active: state.text,
      run: () => editor.chain().focus().setParagraph().run(),
    },
    {
      id: "checklist",
      label: "checklist",
      icon: icon(ListChecks),
      active: state.checklist,
      run: () => editor.chain().focus().toggleTaskList().run(),
    },
    { id: "image", label: "pic", icon: icon(ImageIcon), run: () => add(editor, "image") },
    { id: "link", label: "link", icon: icon(Link2), run: () => add(editor, "link") },
    { id: "voice", label: "voice memo", icon: icon(Mic), run: () => add(editor, "voice") },
    { id: "sticker", label: "sticker", icon: icon(Smile), run: () => add(editor, "sticker") },
  ];

  return (
    <div role="toolbar" aria-label="add a block" className="scrap-toolbar">
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={b.label}
          aria-pressed={b.active}
          title={b.label}
          className="scrap-toolbar__btn"
          // keep the caret in the editor
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.run}
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}
