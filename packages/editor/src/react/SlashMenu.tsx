"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SlashItem } from "./slashItems";

export interface SlashMenuHandle {
  /** returns true when the key was handled (so the editor should not see it) */
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface Props {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  listId: string;
  /** tells the editor which option is active, for aria-activedescendant */
  onActive?: (optionId: string | null) => void;
}

/**
 * Focus stays in the editor the whole time, so this is a listbox the editor points at with
 * aria-activedescendant rather than a menu that takes focus.
 */
export const SlashMenu = forwardRef<SlashMenuHandle, Props>(function SlashMenu(
  { items, command, listId, onActive },
  ref,
) {
  const [selected, setSelected] = useState(0);

  // a new query means a new list: start from the top
  useEffect(() => setSelected(0), [items]);

  const activeId = items[selected] ? `${listId}-${items[selected].id}` : null;
  useEffect(() => {
    onActive?.(activeId);
  }, [activeId, onActive]);

  useImperativeHandle(ref, () => ({
    onKeyDown(event) {
      if (items.length === 0) return false;
      switch (event.key) {
        case "ArrowDown":
          setSelected((i) => (i + 1) % items.length);
          return true;
        case "ArrowUp":
          setSelected((i) => (i - 1 + items.length) % items.length);
          return true;
        case "Enter":
        case "Tab": {
          const item = items[selected];
          if (item) command(item);
          return true;
        }
        default:
          return false;
      }
    },
  }));

  if (items.length === 0) {
    return (
      <div className="sc-menu scrap-slash" role="status">
        <span className="sc-menu__desc" style={{ padding: "8px" }}>
          nothing matches. keep typing or hit esc.
        </span>
      </div>
    );
  }

  return (
    <div className="sc-menu scrap-slash" role="listbox" id={listId} aria-label="drop a block">
      {items.map((item, index) => (
        <button
          key={item.id}
          id={`${listId}-${item.id}`}
          type="button"
          role="option"
          aria-selected={index === selected}
          tabIndex={-1}
          className="sc-menu__item scrap-slash__item"
          data-selected={index === selected}
          // keep the editor focused: the click must not move the caret
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setSelected(index)}
          onClick={() => command(item)}
        >
          <span className="sc-menu__tile" aria-hidden="true">
            {item.icon}
          </span>
          <span className="sc-menu__text">
            <span className="sc-menu__name">{item.name}</span>
            <span className="sc-menu__desc">{item.description}</span>
          </span>
          <span className="sc-keycap">{item.shortcut}</span>
        </button>
      ))}
    </div>
  );
});
