"use client";

import { Sticker, Swatches, type StickerId } from "@scraps/ui";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { CALLOUT_COLORS, type CalloutColor } from "../extensions";

/** Coloured callout card. The colour picker shows while the callout is hovered or has focus. */
export function CalloutView({ node, editor, updateAttributes }: NodeViewProps) {
  const color = String(node.attrs.color ?? "yellow") as CalloutColor;
  const sticker = node.attrs.sticker as StickerId | null;

  return (
    <NodeViewWrapper className="scrap-callout" data-callout="" data-color={color}>
      <div contentEditable={false} className="scrap-callout__chrome">
        {sticker && <Sticker id={sticker} size={32} />}
        {editor.isEditable && (
          <Swatches
            label="callout colour"
            hideLabel
            size="sm"
            colors={CALLOUT_COLORS}
            value={color}
            onChange={(c) => updateAttributes({ color: c ?? "yellow" })}
            className="scrap-callout__colors"
          />
        )}
      </div>
      <NodeViewContent className="scrap-callout__content" />
    </NodeViewWrapper>
  );
}
