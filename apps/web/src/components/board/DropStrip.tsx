"use client";

import { SpaceDot } from "@scraps/ui";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { SpaceSummary } from "@scraps/db";
import { useT } from "@/copy/useT";

/**
 * The spaces a card can be dropped into, slid up from the bottom while it is dragged (feedback
 * round, Oct 13). The same strip, focused, is the keyboard way to move a card ("m").
 */
export function DropStrip({
  spaces,
  hovered,
  keyboard,
  onPick,
  onCancel,
}: {
  spaces: Array<Pick<SpaceSummary, "id" | "name" | "color">>;
  /** the space under the dragged card */
  hovered: string | null;
  /** opened from the keyboard: the chips take focus and escape cancels */
  keyboard: boolean;
  onPick: (spaceId: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (keyboard) first.current?.focus();
  }, [keyboard]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onCancel();
  };

  if (spaces.length === 0 || typeof document === "undefined") return null;
  // on the body: a transformed ancestor would pin a fixed strip to the page instead of the screen
  return createPortal(
    <div
      className="drop-strip"
      role="group"
      aria-label={t(keyboard ? "move.strip.keyboard" : "move.strip")}
    >
      <span className="sc-label drop-strip__label">
        {t(keyboard ? "move.strip.keyboard" : "move.strip")}
      </span>
      <div className="drop-strip__chips">
        {spaces.map((space, index) => (
          <button
            key={space.id}
            ref={index === 0 ? first : undefined}
            type="button"
            data-drop-space={space.id}
            data-drop-hover={hovered === space.id ? "" : undefined}
            tabIndex={keyboard ? 0 : -1}
            className="drop-strip__chip"
            onKeyDown={onKeyDown}
            onClick={() => onPick(space.id)}
          >
            <SpaceDot color={space.color} />
            {space.name}
          </button>
        ))}
        {keyboard && (
          <button
            type="button"
            className="drop-strip__chip drop-strip__cancel"
            onKeyDown={onKeyDown}
            onClick={onCancel}
          >
            {t("move.cancel")}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
