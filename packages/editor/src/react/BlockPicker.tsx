"use client";

import type { Editor } from "@tiptap/core";
import { Sheet } from "@scraps/ui";
import { insertBlock, SLASH_ITEMS } from "./slashItems";

/**
 * Every block the slash menu offers, as big buttons: the "+" way in for phones and for anyone who
 * would rather tap than type "/". A bottom sheet on phones, a dialog on wider screens.
 */
export function BlockPicker({
  editor,
  open,
  onClose,
  where,
}: {
  editor: Editor;
  open: boolean;
  onClose: () => void;
  where: "caret" | "end";
}) {
  return (
    <Sheet open={open} onClose={onClose} title="drop a block">
      <ul className="scrap-picker">
        {SLASH_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="scrap-picker__item"
              onClick={() => {
                onClose();
                insertBlock(editor, item, where);
              }}
            >
              <span className="scrap-picker__icon">{item.icon}</span>
              <span className="scrap-picker__text">
                <span className="scrap-picker__name">{item.name}</span>
                <span className="scrap-picker__desc">{item.description}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
