"use client";

import { RotateCw, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cx } from "../lib";
import { Sticker, type StickerId } from "./Sticker";

export interface StickerPlacement {
  /** centre, in the parent's own units (world px on a board, content px in a scrap) */
  x: number;
  y: number;
  scale: number;
  /** degrees, -180 to 180 */
  rotation: number;
}

export const STICKER_BASE = 72;
export const MIN_STICKER_SCALE = 0.5;
export const MAX_STICKER_SCALE = 3;

/** Wraps an angle into -180..180. */
export function wrapDegrees(deg: number): number {
  const d = ((((deg + 180) % 360) + 360) % 360) - 180;
  return Object.is(d, -0) ? 0 : d;
}

export function clampScale(scale: number): number {
  return Math.min(MAX_STICKER_SCALE, Math.max(MIN_STICKER_SCALE, scale));
}

/**
 * Rotation and scale from dragging the corner handle: the handle's angle and distance from the
 * sticker's centre, relative to where the drag started.
 */
export function handleTransform(
  center: { x: number; y: number },
  from: { x: number; y: number },
  to: { x: number; y: number },
  start: Pick<StickerPlacement, "scale" | "rotation">,
): Pick<StickerPlacement, "scale" | "rotation"> {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const a1 = Math.atan2(to.y - center.y, to.x - center.x);
  const d0 = Math.max(1, Math.hypot(from.x - center.x, from.y - center.y));
  const d1 = Math.hypot(to.x - center.x, to.y - center.y);
  return {
    rotation: Math.round(wrapDegrees(start.rotation + ((a1 - a0) * 180) / Math.PI)),
    scale: Math.round(clampScale(start.scale * (d1 / d0)) * 100) / 100,
  };
}

export interface FreeStickerProps extends StickerPlacement {
  sticker: string;
  editable: boolean;
  selected: boolean;
  /** screen px per parent unit, so a drag follows the pointer at any zoom */
  zoom?: number;
  onSelect: () => void;
  /** live while dragging (done=false), then once more when the gesture ends (done=true) */
  onChange: (next: StickerPlacement, done: boolean) => void;
  onRemove: () => void;
  labels: { sticker: string; remove: string; rotate: string };
  className?: string;
}

/**
 * A sticker that sits anywhere: drag to move, the corner handle to turn and resize, arrows to
 * nudge, [ and ] to turn, - and = to resize, Delete to remove. Used on boards and inside scraps.
 */
export function FreeSticker({
  sticker,
  x,
  y,
  scale,
  rotation,
  editable,
  selected,
  zoom = 1,
  onSelect,
  onChange,
  onRemove,
  labels,
  className,
}: FreeStickerProps) {
  const self = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    kind: "move" | "turn";
    start: { x: number; y: number };
    from: StickerPlacement;
    center: { x: number; y: number };
  } | null>(null);
  const [live, setLive] = useState<StickerPlacement | null>(null);
  const shown = live ?? { x, y, scale, rotation };

  const begin = (event: PointerEvent<HTMLElement>, kind: "move" | "turn") => {
    if (!editable || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.stopPropagation();
    event.preventDefault();
    onSelect();
    const rect = self.current!.getBoundingClientRect();
    gesture.current = {
      kind,
      start: { x: event.clientX, y: event.clientY },
      from: { x, y, scale, rotation },
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const move = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current;
    if (!g) return;
    const next =
      g.kind === "move"
        ? {
            ...g.from,
            x: g.from.x + (event.clientX - g.start.x) / zoom,
            y: g.from.y + (event.clientY - g.start.y) / zoom,
          }
        : {
            ...g.from,
            ...handleTransform(g.center, g.start, { x: event.clientX, y: event.clientY }, g.from),
          };
    setLive(next);
    onChange(next, false);
  };

  const end = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g && live) onChange(live, true);
    setLive(null);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!editable || event.target !== event.currentTarget) return;
    const step = event.shiftKey ? 40 : 8;
    const at = { x, y, scale, rotation };
    let next: StickerPlacement | null = null;
    switch (event.key) {
      case "ArrowLeft":
        next = { ...at, x: x - step };
        break;
      case "ArrowRight":
        next = { ...at, x: x + step };
        break;
      case "ArrowUp":
        next = { ...at, y: y - step };
        break;
      case "ArrowDown":
        next = { ...at, y: y + step };
        break;
      case "[":
        next = { ...at, rotation: wrapDegrees(rotation - 15) };
        break;
      case "]":
        next = { ...at, rotation: wrapDegrees(rotation + 15) };
        break;
      case "-":
        next = { ...at, scale: clampScale(scale - 0.1) };
        break;
      case "=":
      case "+":
        next = { ...at, scale: clampScale(scale + 0.1) };
        break;
      case "Delete":
      case "Backspace":
        event.preventDefault();
        onRemove();
        return;
      default:
        return;
    }
    // the board's own keys (zoom, space switching) stay out of it
    event.preventDefault();
    event.stopPropagation();
    onChange(next, true);
  };

  const size = STICKER_BASE * shown.scale;
  return (
    // the wrapper only places and turns; the sticker itself is the button, and its handles sit
    // beside it (controls nested inside a button are lost to screen readers)
    <div
      ref={self}
      data-free-sticker=""
      className={cx(
        "sc-free-sticker",
        selected && "sc-free-sticker--selected",
        !editable && "sc-free-sticker--static",
        className,
      )}
      style={{
        left: shown.x - size / 2,
        top: shown.y - size / 2,
        width: size,
        height: size,
        transform: `rotate(${shown.rotation}deg)`,
      }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div
        role={editable ? "button" : "img"}
        tabIndex={editable ? 0 : undefined}
        aria-label={labels.sticker}
        aria-pressed={editable ? selected : undefined}
        className="sc-free-sticker__body"
        onPointerDown={(event) => begin(event, "move")}
        onFocus={editable ? onSelect : undefined}
        onKeyDown={onKeyDown}
      >
        <Sticker id={sticker as StickerId} size={size} />
      </div>
      {editable && selected && (
        <>
          <span
            className="sc-free-sticker__handle"
            role="presentation"
            title={labels.rotate}
            onPointerDown={(event) => begin(event, "turn")}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
          >
            <RotateCw size={14} strokeWidth={2.8} aria-hidden="true" />
          </span>
          <button
            type="button"
            className="sc-free-sticker__remove"
            aria-label={labels.remove}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onRemove}
          >
            <X size={14} strokeWidth={3} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
