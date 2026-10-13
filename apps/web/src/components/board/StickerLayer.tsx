"use client";

import type { BoardSticker } from "@scraps/db";
import { Dialog, FreeSticker, STICKER_IDS, Sticker } from "@scraps/ui";
import { Smile, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/copy/useT";

/** The stickers of a board, in world units over the cards. */
export function StickerLayer({
  stickers,
  editable,
  zoom,
  selected,
  onSelect,
  onSave,
  onRemove,
}: {
  stickers: BoardSticker[];
  editable: boolean;
  zoom: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onSave: (sticker: BoardSticker) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  // the one being dragged follows the pointer here and is saved once, when it is let go
  const [live, setLive] = useState<BoardSticker | null>(null);
  const ordered = [...stickers].sort((a, b) => a.z - b.z);
  return (
    <div className="canvas__stickers">
      {ordered.map((s) => {
        const shown = live?.id === s.id ? live : s;
        return (
          <FreeSticker
            key={s.id}
            sticker={s.sticker}
            x={shown.x}
            y={shown.y}
            scale={shown.scale}
            rotation={shown.rotation}
            editable={editable}
            selected={selected === s.id}
            zoom={zoom}
            onSelect={() => onSelect(s.id)}
            onChange={(next, done) => {
              const updated = { ...s, ...next, x: Math.round(next.x), y: Math.round(next.y) };
              if (done) {
                setLive(null);
                onSave(updated);
              } else {
                setLive(updated);
              }
            }}
            onRemove={() => {
              onSelect(null);
              onRemove(s.id);
            }}
            labels={{
              sticker: t("sticker.label", { name: s.sticker.replace(/-/g, " ") }),
              remove: t("sticker.remove"),
              rotate: t("sticker.rotate"),
            }}
          />
        );
      })}
    </div>
  );
}

const HINT_KEY = "scraps.hint.board-stickers";

/** Whether the board-sticker hint was already seen on this device. */
function hintSeen(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true; // no storage: never nag
  }
}

function markHintSeen(): void {
  try {
    window.localStorage.setItem(HINT_KEY, "1");
  } catch {
    // not remembered; harmless
  }
}

/**
 * The "add a sticker" button for the canvas toolbar, with its picker. It says "sticker" where
 * there is room, and `nudge` offers a one-time hint above the toolbar (dismissed for good on this
 * device by "got it", "show me" or placing a sticker).
 */
export function AddStickerButton({
  onPick,
  nudge = false,
}: {
  onPick: (sticker: string) => void;
  nudge?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(false);
  // read after mount: the server render has no storage
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHint(nudge && !hintSeen());
  }, [nudge]);
  const dismiss = () => {
    markHintSeen();
    setHint(false);
  };

  return (
    <>
      {hint && (
        <div className="canvas__hint" role="status">
          <p className="canvas__hint-text">{t("sticker.hint")}</p>
          <button
            type="button"
            className="canvas__hint-try"
            onClick={() => {
              dismiss();
              setOpen(true);
            }}
          >
            {t("sticker.hint.try")}
          </button>
          <button
            type="button"
            className="canvas__hint-close"
            aria-label={t("sticker.hint.dismiss")}
            onClick={dismiss}
          >
            <X size={16} strokeWidth={2.8} aria-hidden="true" />
          </button>
        </div>
      )}
      <button
        type="button"
        className="canvas__zoom-btn canvas__sticker-btn"
        aria-label={t("sticker.add")}
        onClick={() => {
          if (hint) dismiss();
          setOpen(true);
        }}
      >
        <Smile size={18} strokeWidth={2.6} aria-hidden="true" />
        <span className="canvas__sticker-label" aria-hidden="true">
          {t("sticker.add.short")}
        </span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("sticker.add")}>
        <ul className="icon-picker__grid">
          {STICKER_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="icon-picker__btn"
                aria-label={id.replace(/-/g, " ")}
                onClick={() => {
                  setOpen(false);
                  onPick(id);
                }}
              >
                <Sticker id={id} size={44} />
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
