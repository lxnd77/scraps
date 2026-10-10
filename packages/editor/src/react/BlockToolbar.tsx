"use client";

import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { Image as ImageIcon, Link2, ListChecks, Mic, Smile, Type } from "lucide-react";
import type { ReactNode } from "react";

interface ToolbarButton {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
  /** media blocks arrive in Phase 4 */
  soon?: boolean;
  run?: () => void;
}

const icon = (Icon: typeof Type) => <Icon size={24} strokeWidth={2.4} aria-hidden="true" />;

/**
 * Floating block toolbar for touch (SPEC 6.5), replacing the slash menu on phones.
 * Buttons keep the editor focused so the keyboard stays up.
 */
export function BlockToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      checklist: e.isActive("taskList"),
      text: e.isActive("paragraph"),
    }),
  });

  const buttons: ToolbarButton[] = [
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
    { id: "image", label: "image", icon: icon(ImageIcon), soon: true },
    { id: "link", label: "link", icon: icon(Link2), soon: true },
    { id: "voice", label: "voice memo", icon: icon(Mic), soon: true },
    { id: "sticker", label: "sticker", icon: icon(Smile), soon: true },
  ];

  return (
    <div role="toolbar" aria-label="add a block" className="scrap-toolbar">
      {buttons.map((b) => (
        <button
          key={b.id}
          type="button"
          aria-label={b.label}
          aria-pressed={b.soon ? undefined : b.active}
          aria-disabled={b.soon ? true : undefined}
          title={b.soon ? "coming soon" : b.label}
          className="scrap-toolbar__btn"
          // keep the caret in the editor
          onMouseDown={(e) => e.preventDefault()}
          onClick={b.soon ? undefined : b.run}
        >
          {b.icon}
        </button>
      ))}
    </div>
  );
}
