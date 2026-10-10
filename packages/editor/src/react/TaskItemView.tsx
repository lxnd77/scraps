"use client";

import { Avatar, Checkbox, type StickerId } from "@scraps/ui";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMembers } from "./members";

/** One checklist row: the design-system checkbox, the item's text and its assignee. */
export function TaskItemView({ node, editor, updateAttributes }: NodeViewProps) {
  const checked = Boolean(node.attrs.checked);
  const label = node.textContent.trim() || "checklist item";
  const members = useMembers();
  const assigneeId = (node.attrs.assigneeId as string | null) ?? null;
  const assignee = members.find((m) => m.id === assigneeId) ?? null;
  const [picking, setPicking] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const editable = editor.isEditable;

  // close on outside click or Escape
  useEffect(() => {
    if (!picking) return;
    const onDown = (event: MouseEvent) => {
      if (!holder.current?.contains(event.target as Node)) setPicking(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicking(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [picking]);

  return (
    <NodeViewWrapper className="scrap-task" data-type="taskItem" data-checked={checked}>
      <span contentEditable={false} className="scrap-task__box">
        <Checkbox
          aria-label={`${checked ? "mark not done" : "mark done"}: ${label}`}
          checked={checked}
          disabled={!editor.isEditable}
          onChange={(next) => updateAttributes({ checked: next })}
        />
      </span>
      <NodeViewContent className="scrap-task__content" />
      {(assignee || (editable && members.length > 1)) && (
        <span contentEditable={false} className="scrap-task__assignee" ref={holder}>
          {editable && members.length > 1 ? (
            <button
              type="button"
              className="scrap-task__assign"
              aria-haspopup="menu"
              aria-expanded={picking}
              aria-label={assignee ? `assigned to ${assignee.name}` : "assign this item"}
              onClick={() => setPicking((p) => !p)}
            >
              {assignee ? (
                <Avatar
                  name={assignee.name}
                  color={assignee.accent}
                  sticker={assignee.sticker as StickerId | undefined}
                  size={28}
                />
              ) : (
                <UserPlus size={16} strokeWidth={2.6} aria-hidden="true" />
              )}
            </button>
          ) : (
            assignee && (
              <Avatar
                name={assignee.name}
                color={assignee.accent}
                sticker={assignee.sticker as StickerId | undefined}
                size={28}
              />
            )
          )}
          {picking && (
            <div role="menu" aria-label="assign to" className="scrap-task__menu">
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitem"
                  className="scrap-task__menu-item"
                  onClick={() => {
                    updateAttributes({ assigneeId: m.id });
                    setPicking(false);
                  }}
                >
                  <Avatar
                    name={m.name}
                    color={m.accent}
                    sticker={m.sticker as StickerId | undefined}
                    size={24}
                  />
                  <span>{m.name}</span>
                </button>
              ))}
              {assignee && (
                <button
                  type="button"
                  role="menuitem"
                  className="scrap-task__menu-item"
                  onClick={() => {
                    updateAttributes({ assigneeId: null });
                    setPicking(false);
                  }}
                >
                  unassign
                </button>
              )}
            </div>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}
