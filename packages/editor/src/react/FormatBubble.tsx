"use client";

import type { Editor } from "@tiptap/core";
import { Swatches } from "@scraps/ui";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Code, Italic, Strikethrough } from "lucide-react";
import { CALLOUT_COLORS, type CalloutColor } from "../extensions";

const icon = (Icon: typeof Bold) => <Icon size={18} strokeWidth={2.6} aria-hidden="true" />;

/**
 * Formatting for a text selection: bold, italic, strike, code and a highlight colour. Shows only
 * over a non-empty text selection in the body, never in the title or inside code.
 */
export function FormatBubble({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight")
        ? (((e.getAttributes("highlight").color as string | null) ?? "yellow") as CalloutColor)
        : null,
    }),
  });

  const marks = [
    { id: "bold", label: "bold", icon: icon(Bold), active: state.bold },
    { id: "italic", label: "italic", icon: icon(Italic), active: state.italic },
    { id: "strike", label: "strike", icon: icon(Strikethrough), active: state.strike },
    { id: "code", label: "code", icon: icon(Code), active: state.code },
  ] as const;

  return (
    <BubbleMenu
      editor={editor}
      className="scrap-bubble"
      shouldShow={({ editor: e, state: s, from, to }) => {
        if (!e.isEditable || from === to) return false;
        if (s.selection.$from.parent.type.name === "title") return false;
        if (e.isActive("codeBlock")) return false;
        return s.doc.textBetween(from, to).trim().length > 0;
      }}
    >
      <div role="toolbar" aria-label="format text" className="scrap-bubble__marks">
        {marks.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-label={m.label}
            aria-pressed={m.active}
            title={m.label}
            className="scrap-bubble__btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleMark(m.id).run()}
          >
            {m.icon}
          </button>
        ))}
      </div>
      <Swatches
        label="highlight"
        hideLabel
        size="sm"
        none="no highlight"
        colors={CALLOUT_COLORS}
        value={state.highlight}
        onChange={(color) => {
          const chain = editor.chain().focus();
          if (color === null) chain.unsetHighlight().run();
          // yellow is the plain marker, so it is stored without a colour
          else chain.setMark("highlight", { color: color === "yellow" ? null : color }).run();
        }}
        className="scrap-bubble__colors"
      />
    </BubbleMenu>
  );
}
