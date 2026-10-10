"use client";

import { Button, Dialog } from "@scraps/ui";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/copy/useT";

export const NOTE_COLORS = [
  "yellow",
  "lime",
  "pink",
  "blue",
  "lilac",
  "orange",
  "surface",
] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

interface Props {
  open: boolean;
  onClose: () => void;
  color: string;
  pinned: boolean;
  onColor: (color: NoteColor) => void;
  onPin: (pinned: boolean) => void;
  onDelete: () => void;
  /** other spaces the scrap can move to; omit to hide the move section */
  moveTargets?: Array<{ id: string; name: string }>;
  onMove?: (spaceId: string) => void;
}

/** The "more" menu: card colour, pin and soft delete (SPEC 6.5). Move and sticker come later. */
export function NoteMenu({
  open,
  onClose,
  color,
  pinned,
  onColor,
  onPin,
  onDelete,
  moveTargets,
  onMove,
}: Props) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);

  function close() {
    setConfirming(false);
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} title={t("note.menu.title")}>
      {confirming ? (
        <div className="note-menu">
          <p className="note-menu__lead">{t("note.delete.confirm")}</p>
          <p className="field-hint">{t("note.delete.body")}</p>
          <div className="space-form__actions">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t("space.cancel")}
            </Button>
            <Button
              variant="dark"
              onClick={() => {
                onDelete();
                close();
              }}
            >
              <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("note.delete.yes")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="note-menu">
          <fieldset className="picker">
            <legend className="field-label">{t("note.colour")}</legend>
            <div className="picker__row">
              {NOTE_COLORS.map((c) => (
                <label key={c} className="picker__option">
                  <input
                    type="radio"
                    name="note-color"
                    value={c}
                    checked={color === c}
                    onChange={() => onColor(c)}
                    className="picker__input"
                  />
                  <span className={`picker__swatch sc-fill-${c}`} />
                  <span className="sr-only">{c}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {moveTargets && moveTargets.length > 0 && onMove && (
            <div className="picker">
              {moveTargets.map((target) => (
                <Button
                  key={target.id}
                  variant="ghost"
                  onClick={() => {
                    onMove(target.id);
                    close();
                  }}
                >
                  {t("card.move", { space: target.name })}
                </Button>
              ))}
            </div>
          )}

          <Button variant="ghost" onClick={() => onPin(!pinned)} aria-pressed={pinned}>
            {pinned ? (
              <PinOff size={18} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Pin size={18} strokeWidth={2.6} aria-hidden="true" />
            )}
            {pinned ? t("note.unpin") : t("note.pin")}
          </Button>

          <Button variant="ghost" onClick={() => setConfirming(true)}>
            <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
            {t("note.delete")}
          </Button>
        </div>
      )}
    </Dialog>
  );
}
