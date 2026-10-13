"use client";

import { Button, Dialog } from "@scraps/ui";
import { Pin, PinOff, Share2, Sparkles, Trash2, FolderInput, Move } from "lucide-react";
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
  /** opens the share dialog (the top bar button is desktop only) */
  onShare?: () => void;
  /** asks for a "file under…" suggestion for this scrap */
  onSuggest?: () => void;
  /** opens the space strip: the tap-and-pick way to move a scrap (dragging is the other) */
  onMoveToSpace?: () => void;
  /** starts "tap where it goes" on the board: the tap way to move a card (dragging is the other) */
  onPlace?: () => void;
}

/**
 * The "more" menu: card colour, pin and soft delete (SPEC 6.5), plus the tap ways to move a card on
 * the board or to another space, for anyone who cannot or would rather not drag.
 */
export function NoteMenu({
  open,
  onClose,
  color,
  pinned,
  onColor,
  onPin,
  onDelete,
  onShare,
  onSuggest,
  onMoveToSpace,
  onPlace,
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

          {onShare && (
            <Button
              variant="ghost"
              onClick={() => {
                close();
                onShare();
              }}
            >
              <Share2 size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("share.open")}
            </Button>
          )}

          {onPlace && (
            <Button
              variant="ghost"
              onClick={() => {
                close();
                onPlace();
              }}
            >
              <Move size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("note.menu.place")}
            </Button>
          )}

          {onMoveToSpace && (
            <Button
              variant="ghost"
              onClick={() => {
                close();
                onMoveToSpace();
              }}
            >
              <FolderInput size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("note.menu.move")}
            </Button>
          )}

          {onSuggest && (
            <Button
              variant="ghost"
              onClick={() => {
                close();
                onSuggest();
              }}
            >
              <Sparkles size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("note.menu.suggest")}
            </Button>
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
