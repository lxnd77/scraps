"use client";

import { Dialog, FreeSticker, STICKER_IDS, Sticker, STICKER_BASE } from "@scraps/ui";
import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import type { Doc } from "yjs";
import {
  putSticker,
  readStickers,
  removeSticker,
  STICKER_MAP,
  type FloatingSticker,
} from "../stickers";

type Opener = (at: { x: number; y: number }) => void;
// each browser editor's sticker layer, so the slash menu and the block picker can reach it
const openers = new WeakMap<Editor, Opener>();

/** Opens the sticker picker for this editor (the chosen one lands at a screen point), if any. */
export function stickerOpener(editor: Editor): Opener | null {
  return openers.get(editor) ?? null;
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

/** Stickers floating over a scrap, kept in the note's Y.Doc (see ../stickers.ts). */
export function StickerLayer({
  editor,
  ydoc,
  editable,
}: {
  editor: Editor;
  ydoc: Doc;
  editable: boolean;
}) {
  const layer = useRef<HTMLDivElement>(null);
  const [stickers, setStickers] = useState(() => readStickers(ydoc));
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [live, setLive] = useState<{ id: string; s: FloatingSticker } | null>(null);
  const [picking, setPicking] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const map = ydoc.getMap(STICKER_MAP);
    const update = () => setStickers(readStickers(ydoc));
    update();
    map.observe(update);
    return () => map.unobserve(update);
  }, [ydoc]);

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!editable) return;
    openers.set(editor, (at) => setPicking(at));
    return () => {
      openers.delete(editor);
    };
  }, [editor, editable]);

  // a press anywhere else lets go of the selection
  useEffect(() => {
    if (!selected) return;
    const onDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest?.("[data-free-sticker]")) setSelected(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [selected]);

  const place = (sticker: string, at: { x: number; y: number }) => {
    const rect = layer.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const id = newId();
    const half = STICKER_BASE / 2;
    putSticker(ydoc, id, {
      sticker,
      x: Math.min(1, Math.max(0, (at.x - rect.left + half) / rect.width)),
      y: Math.max(0, at.y - rect.top + half),
      scale: 1,
      // a little wonk from the id, like the cards' tilt
      rotation: (parseInt(id.slice(0, 2), 16) % 25) - 12,
    });
    setSelected(id);
  };

  return (
    <div ref={layer} className="scrap-stickers">
      {width > 0 &&
        stickers.map(([id, stored]) => {
          const s = live?.id === id ? live.s : stored;
          return (
            <FreeSticker
              key={id}
              sticker={s.sticker}
              x={s.x * width}
              y={s.y}
              scale={s.scale}
              rotation={s.rotation}
              editable={editable}
              selected={selected === id}
              onSelect={() => setSelected(id)}
              onChange={(next, done) => {
                const moved = { ...s, ...next, x: next.x / width };
                if (done) {
                  setLive(null);
                  putSticker(ydoc, id, moved);
                } else {
                  setLive({ id, s: moved });
                }
              }}
              onRemove={() => {
                setSelected(null);
                removeSticker(ydoc, id);
              }}
              labels={{
                sticker: `${s.sticker.replace(/-/g, " ")} sticker`,
                remove: "peel it off",
                rotate: "turn and resize",
              }}
            />
          );
        })}
      <Dialog open={picking !== null} onClose={() => setPicking(null)} title="pick a sticker">
        <ul className="icon-picker__grid">
          {STICKER_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                className="icon-picker__btn"
                aria-label={id.replace(/-/g, " ")}
                onClick={() => {
                  const at = picking;
                  setPicking(null);
                  if (at) place(id, at);
                }}
              >
                <Sticker id={id} size={44} />
              </button>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  );
}
