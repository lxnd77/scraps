"use client";

import type { BoardSticker } from "@scraps/db";
import { Dialog, FreeSticker, STICKER_IDS, Sticker } from "@scraps/ui";
import { Smile } from "lucide-react";
import { useState } from "react";
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

/** The "add a sticker" button for the canvas toolbar, with its picker. */
export function AddStickerButton({ onPick }: { onPick: (sticker: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="canvas__zoom-btn"
        aria-label={t("sticker.add")}
        data-tip={t("sticker.add")}
        data-tip-pos="top"
        data-tip-align="end"
        onClick={() => setOpen(true)}
      >
        <Smile size={18} strokeWidth={2.6} aria-hidden="true" />
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
