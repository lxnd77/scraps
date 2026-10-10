"use client";

import { Sticker, type StickerId } from "@scraps/ui";
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { CALLOUT_COLORS } from "../extensions";

/** Coloured callout card. The colour picker only shows while the callout has focus. */
export function CalloutView({ node, editor, updateAttributes }: NodeViewProps) {
  const color = String(node.attrs.color ?? "yellow");
  const sticker = node.attrs.sticker as StickerId | null;

  return (
    <NodeViewWrapper className="scrap-callout" data-callout="" data-color={color}>
      <div contentEditable={false} className="scrap-callout__chrome">
        {sticker && <Sticker id={sticker} size={32} />}
        {editor.isEditable && (
          <div role="radiogroup" aria-label="callout colour" className="scrap-callout__colors">
            {CALLOUT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === color}
                aria-label={c}
                className={`scrap-callout__swatch sc-fill-${c}`}
                onClick={() => updateAttributes({ color: c })}
              />
            ))}
          </div>
        )}
      </div>
      <NodeViewContent className="scrap-callout__content" />
    </NodeViewWrapper>
  );
}
