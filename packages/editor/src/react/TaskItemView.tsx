"use client";

import { Checkbox } from "@scraps/ui";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

/** One checklist row: the design-system checkbox, then the item's own paragraph(s). */
export function TaskItemView({ node, editor, updateAttributes }: NodeViewProps) {
  const checked = Boolean(node.attrs.checked);
  const label = node.textContent.trim() || "checklist item";

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
    </NodeViewWrapper>
  );
}
