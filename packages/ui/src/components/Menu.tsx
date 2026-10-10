"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "../lib";

export interface MenuItem {
  id: string;
  label: string;
  description?: string;
  /** mono shortcut hint, e.g. "/todo" */
  shortcut?: string;
  icon?: ReactNode;
  onSelect: () => void;
}

export interface MenuProps {
  label: string;
  items: MenuItem[];
  /** focus the first item on mount (context menus, slash menu) */
  focusOnMount?: boolean;
  onEscape?: () => void;
  className?: string;
}

/** Slash menu and context menu panel with roving focus. Position it from the caller. */
export function Menu({ label, items, focusOnMount = false, onEscape, className }: MenuProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (focusOnMount) refs.current[0]?.focus();
  }, [focusOnMount]);

  function move(from: number, delta: number) {
    const count = items.length;
    if (count === 0) return;
    refs.current[(from + delta + count) % count]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        move(index, 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        move(index, -1);
        break;
      case "Home":
        event.preventDefault();
        refs.current[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        refs.current[items.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        onEscape?.();
        break;
    }
  }

  return (
    <div role="menu" aria-label={label} className={cx("sc-menu", className)}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="button"
          role="menuitem"
          tabIndex={index === 0 ? 0 : -1}
          className="sc-menu__item"
          onFocus={(event) => {
            refs.current.forEach((el) => el && (el.tabIndex = -1));
            event.currentTarget.tabIndex = 0;
          }}
          onKeyDown={(event) => onKeyDown(event, index)}
          onClick={item.onSelect}
        >
          {item.icon && (
            <span className="sc-menu__tile" aria-hidden="true">
              {item.icon}
            </span>
          )}
          <span className="sc-menu__text">
            <span className="sc-menu__name">{item.label}</span>
            {item.description && <span className="sc-menu__desc">{item.description}</span>}
          </span>
          {item.shortcut && <span className="sc-keycap">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
