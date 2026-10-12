"use client";

import { Sticker, type StickerId } from "@scraps/ui";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

// ---- sticker --------------------------------------------------------------------------

export function StickerView({ node }: NodeViewProps) {
  const id = String(node.attrs.id ?? "sparkle") as StickerId;
  const size = Number(node.attrs.size ?? 64);
  return (
    <NodeViewWrapper as="span" className="scrap-sticker" data-type="sticker">
      <span contentEditable={false}>
        <Sticker id={id} size={size} />
      </span>
    </NodeViewWrapper>
  );
}
