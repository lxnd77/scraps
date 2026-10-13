"use client";

import type { BoardPos, NoteSummary } from "@scraps/db";
import { Minus, Plus, Scan } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useT } from "@/copy/useT";
import { registerPlacer } from "@/lib/optimistic";
import {
  boundsOf,
  CARD_W,
  estimateHeight,
  freeSpot,
  freezePositions,
  GRID,
  layoutBoard,
  readingOrder,
  snap,
  visibleBoxes,
  type CardBox,
} from "./layout";
import {
  fitTo,
  HOME,
  readViewport,
  visibleWorld,
  writeViewport,
  zoomAt,
  type Viewport,
} from "./viewport";

/** Cards render only near the view once a board is this big. */
const CULL_FROM = 150;
const DRAG_THRESHOLD = 6;
const TOUCH_SLOP = 8;
const LONG_PRESS_MS = 300;

/** Zoom steps for the buttons and +/- keys. */
const ZOOM_STEP = 1.25;

/** What the shortcuts provider sends a mounted canvas. */
export type CanvasCommand = "zoom-in" | "zoom-out" | "zoom-reset" | "fit";
export const CANVAS_EVENT = "scraps:canvas";

export interface CanvasDrag {
  note: NoteSummary;
  /** pointer on screen (viewport px) */
  point: { x: number; y: number };
}

interface CanvasProps {
  spaceId: string;
  /** every scrap, pinned first then most recent (the order unplaced ones flow in) */
  notes: NoteSummary[];
  canEdit: boolean;
  /** cards that do not match the filter stay in place, dimmed */
  dimmed: (note: NoteSummary) => boolean;
  renderCard: (note: NoteSummary) => ReactNode;
  /** one card moved; `freeze` are the cards still flowing, to pin where they are now */
  onPlace: (note: NoteSummary, pos: BoardPos, freeze: Array<{ id: string } & BoardPos>) => void;
  /** a card is being dragged (null when it lets go), for the drop strip */
  onDrag?: (drag: CanvasDrag | null) => void;
  /** a card was let go over something outside the canvas; true when that took it */
  onDropOutside?: (note: NoteSummary, point: { x: number; y: number }) => boolean;
  /** behind the cards (board stickers) */
  /** over the cards, in world units (board stickers) */
  overlay?: (view: Viewport) => ReactNode;
  /** extra buttons in the corner toolbar; `center` is the world point in the middle of the view */
  tools?: (center: () => { x: number; y: number }) => ReactNode;
  /** a press on the background or a card (not a sticker): clears a sticker selection */
  onBackgroundPress?: () => void;
  label: string;
}

type Gesture =
  | { kind: "pan"; pointerId: number; start: { x: number; y: number }; view: Viewport }
  | {
      kind: "card-pending" | "card";
      pointerId: number;
      touch: boolean;
      id: string;
      start: { x: number; y: number };
      origin: { x: number; y: number };
    }
  | {
      kind: "pinch";
      start: { dist: number; mid: { x: number; y: number } };
      view: Viewport;
    };

const INTERACTIVE =
  "button, input, select, textarea, label, [role='checkbox'], [contenteditable='true']";

/**
 * The board as an infinite canvas (feedback round, Oct 13): pan, zoom, and cards dragged anywhere,
 * snapping to a 24px grid. Positions are shared (notes.board_pos); unplaced cards flow below.
 */
export function Canvas({
  spaceId,
  notes,
  canEdit,
  dimmed,
  renderCard,
  onPlace,
  onDrag,
  onDropOutside,
  overlay,
  tools,
  onBackgroundPress,
  label,
}: CanvasProps) {
  const t = useT();
  const shell = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<Viewport>(HOME);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());
  const [drag, setDragState] = useState<{ id: string; x: number; y: number } | null>(null);
  // the same value for the pointer handlers, which must not run side effects in a state updater
  const dragRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const setDrag = useCallback((next: { id: string; x: number; y: number } | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);
  const [announce, setAnnounce] = useState("");
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const longPress = useRef<number | null>(null);
  const swallowClick = useRef(false);

  const boxes = useMemo(() => layoutBoard(notes, heights), [notes, heights]);
  const byId = useMemo(() => new Map(boxes.map((b) => [b.id, b])), [boxes]);
  const noteById = useMemo(() => new Map(notes.map((n) => [n.id, n])), [notes]);

  // the latest values for listeners that are bound once
  const live = useRef({ view, size, boxes, noteById, canEdit, onPlace, onDrag, onDropOutside });
  useLayoutEffect(() => {
    live.current = { view, size, boxes, noteById, canEdit, onPlace, onDrag, onDropOutside };
  });

  // ---- size, remembered view ----------------------------------------------------------------

  useLayoutEffect(() => {
    const el = shell.current;
    if (!el) return;
    const measure = () => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
      // fill the window below the board header, whatever the header's height on this screen
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty("--canvas-top", `${Math.round(top)}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const restored = useRef(false);
  useEffect(() => {
    restored.current = false;
    // read after mount: the server render has no storage
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView(readViewport(spaceId) ?? HOME);
    restored.current = true;
  }, [spaceId]);

  useEffect(() => {
    if (!restored.current) return;
    const id = window.setTimeout(() => writeViewport(spaceId, view), 250);
    return () => window.clearTimeout(id);
  }, [spaceId, view]);

  // ---- card heights ---------------------------------------------------------------------------

  // created on first use: card refs attach during commit, before any effect has run
  const observer = useRef<ResizeObserver | null>(null);
  const getObserver = useCallback(() => {
    observer.current ??= new ResizeObserver((entries) => {
      const measured: Array<[string, number]> = [];
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        const id = el.dataset.canvasCard;
        const h = Math.round(el.offsetHeight);
        if (id && h > 0) measured.push([id, h]);
      }
      if (measured.length === 0) return;
      setHeights((old) => {
        if (measured.every(([id, h]) => old.get(id) === h)) return old;
        const next = new Map(old);
        for (const [id, h] of measured) next.set(id, h);
        return next;
      });
    });
    return observer.current;
  }, []);
  useEffect(() => () => observer.current?.disconnect(), []);
  const measureCard = useCallback(
    (el: HTMLElement | null) => {
      if (el) getObserver().observe(el);
    },
    [getObserver],
  );

  // ---- new scraps from this device land in view ---------------------------------------------

  // a card placed off screen (the view was full) is brought into view once it renders
  const reveal = useRef<string | null>(null);
  useEffect(() => {
    return registerPlacer(spaceId, (summary) => {
      reveal.current = summary.id;
      const { view: v, size: s, boxes: b } = live.current;
      if (s.w === 0) return null;
      const shown = visibleWorld(v, s);
      const inset = {
        x: shown.x + GRID,
        y: shown.y + GRID,
        w: shown.w - 2 * GRID,
        h: shown.h - 2 * GRID,
      };
      return freeSpot(b, inset, estimateHeight(summary), inset);
    });
  }, [spaceId]);

  // ---- zoom ---------------------------------------------------------------------------------

  const zoomBy = useCallback((factor: number, at?: { x: number; y: number }) => {
    setView((v) => {
      const { size: s } = live.current;
      return zoomAt(v, v.zoom * factor, at ?? { x: s.w / 2, y: s.h / 2 });
    });
  }, []);
  const fit = useCallback(() => {
    const { boxes: b, size: s } = live.current;
    setView(fitTo(boundsOf(b), s));
  }, []);
  const reset = useCallback(() => {
    setView((v) => zoomAt(v, 1, { x: live.current.size.w / 2, y: live.current.size.h / 2 }));
  }, []);

  useEffect(() => {
    const onCommand = (event: Event) => {
      const command = (event as CustomEvent<CanvasCommand>).detail;
      if (command === "zoom-in") zoomBy(ZOOM_STEP);
      else if (command === "zoom-out") zoomBy(1 / ZOOM_STEP);
      else if (command === "zoom-reset") reset();
      else if (command === "fit") fit();
    };
    window.addEventListener(CANVAS_EVENT, onCommand);
    return () => window.removeEventListener(CANVAS_EVENT, onCommand);
  }, [zoomBy, reset, fit]);

  // wheel: pan, or zoom with ctrl (trackpad pinches arrive as ctrl+wheel)
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      if (event.ctrlKey || event.metaKey) {
        // gentle per notch: a mouse wheel step is about 100, a trackpad pinch a few at a time
        const unit = event.deltaMode === 1 ? 16 : 1;
        const factor = Math.exp(-Math.max(-60, Math.min(60, event.deltaY * unit)) * 0.004);
        zoomBy(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
      } else {
        const unit = event.deltaMode === 1 ? 16 : 1;
        setView((v) => ({ ...v, x: v.x - event.deltaX * unit, y: v.y - event.deltaY * unit }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // ---- pointer gestures ---------------------------------------------------------------------

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = shell.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startCardDrag = useCallback(
    (g: Extract<Gesture, { kind: "card-pending" | "card" }>) => {
      g.kind = "card";
      setDrag({ id: g.id, x: g.origin.x, y: g.origin.y });
      if (g.touch && "vibrate" in navigator) navigator.vibrate?.(10);
    },
    [setDrag],
  );

  const endGesture = useCallback(
    (event: PointerEvent | null) => {
      if (longPress.current) window.clearTimeout(longPress.current);
      longPress.current = null;
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.kind !== "card") return;
      const { noteById: notesNow, boxes: all, onPlace: place, onDrag: dragged } = live.current;
      const note = notesNow.get(g.id);
      const current = dragRef.current;
      setDrag(null);
      dragged?.(null);
      if (!note || !current || !event) return;
      // the click that ends a drag must not open the card
      swallowClick.current = true;
      window.setTimeout(() => (swallowClick.current = false), 0);
      const taken = live.current.onDropOutside?.(note, { x: event.clientX, y: event.clientY });
      if (taken) return;
      const pos = { x: snap(current.x), y: snap(current.y) };
      const freeze = freezePositions(all.filter((b) => !b.placed && b.id !== note.id));
      place(note, pos, freeze);
    },
    [setDrag],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      const p = local(event);
      pointers.current.set(event.pointerId, p);
      const g = gesture.current;
      if (!g) return;

      if (g.kind === "pinch") {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoomed = zoomAt(g.view, g.view.zoom * (dist / g.start.dist), g.start.mid);
        setView({
          ...zoomed,
          x: zoomed.x + mid.x - g.start.mid.x,
          y: zoomed.y + mid.y - g.start.mid.y,
        });
        return;
      }
      if (event.pointerId !== g.pointerId) return;
      const dx = p.x - g.start.x;
      const dy = p.y - g.start.y;

      if (g.kind === "pan") {
        setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
        return;
      }
      if (g.kind === "card-pending") {
        const moved = Math.hypot(dx, dy);
        if (g.touch) {
          // a finger that moves before the long press pans instead
          if (moved > TOUCH_SLOP) {
            if (longPress.current) window.clearTimeout(longPress.current);
            gesture.current = {
              kind: "pan",
              pointerId: g.pointerId,
              start: p,
              view: live.current.view,
            };
          }
          return;
        }
        if (moved < DRAG_THRESHOLD) return;
        startCardDrag(g);
      }
      if (g.kind === "card") {
        const zoom = live.current.view.zoom;
        setDrag({ id: g.id, x: g.origin.x + dx / zoom, y: g.origin.y + dy / zoom });
        const note = live.current.noteById.get(g.id);
        if (note) live.current.onDrag?.({ note, point: { x: event.clientX, y: event.clientY } });
      }
    };
    const onUp = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.delete(event.pointerId);
      const g = gesture.current;
      if (g?.kind === "pinch") {
        // one finger left: carry on as a pan from here
        const [rest] = [...pointers.current.entries()];
        gesture.current = rest
          ? { kind: "pan", pointerId: rest[0], start: rest[1], view: live.current.view }
          : null;
        return;
      }
      if (g && "pointerId" in g && g.pointerId === event.pointerId) {
        endGesture(event.type === "pointercancel" ? null : event);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [endGesture, startCardDrag, setDrag]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const p = local(event);
    pointers.current.set(event.pointerId, p);

    if (pointers.current.size === 2) {
      // a second finger: pinch, and whatever the first finger was doing stops
      if (longPress.current) window.clearTimeout(longPress.current);
      if (gesture.current?.kind === "card") endGesture(null);
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        kind: "pinch",
        start: {
          dist: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)),
          mid: { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 },
        },
        view,
      };
      return;
    }
    if (pointers.current.size > 2) return;

    const target = event.target as HTMLElement;
    // stickers handle their own drag; the toolbar is just buttons
    if (target.closest("[data-free-sticker]") || target.closest("[data-canvas-ui]")) return;
    onBackgroundPress?.();
    if (target.closest(INTERACTIVE)) return;
    const cardEl = target.closest<HTMLElement>("[data-canvas-card]");
    const id = cardEl?.dataset.canvasCard;
    const box = id ? byId.get(id) : undefined;
    const touch = event.pointerType !== "mouse";

    if (box && canEdit) {
      const g: Gesture = {
        kind: "card-pending",
        pointerId: event.pointerId,
        touch,
        id: box.id,
        start: p,
        origin: { x: box.x, y: box.y },
      };
      gesture.current = g;
      if (touch) {
        longPress.current = window.setTimeout(() => {
          if (gesture.current === g) startCardDrag(g);
        }, LONG_PRESS_MS);
      }
      return;
    }
    if (box && !touch) return; // viewers click cards; panning starts on the background
    gesture.current = { kind: "pan", pointerId: event.pointerId, start: p, view };
  }

  // ---- keyboard: alt+arrows move the focused card --------------------------------------------

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!event.altKey || !canEdit) return;
    const step = event.shiftKey ? 5 : 1;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const d = delta[event.key];
    if (!d) return;
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-canvas-card]")?.dataset
      .canvasCard;
    const box = id ? byId.get(id) : undefined;
    const note = id ? noteById.get(id) : undefined;
    if (!box || !note) return;
    event.preventDefault();
    event.stopPropagation();
    const pos = { x: snap(box.x) + d[0], y: snap(box.y) + d[1] };
    onPlace(note, pos, freezePositions(boxes.filter((b) => !b.placed && b.id !== note.id)));
    setAnnounce(t("canvas.moved", { x: pos.x, y: pos.y }));
    // keep the moved card on screen
    setView((v) => {
      const screenX = pos.x * GRID * v.zoom + v.x;
      const screenY = pos.y * GRID * v.zoom + v.y;
      const pad = 24;
      let { x, y } = v;
      if (screenX < pad) x += pad - screenX;
      if (screenX + CARD_W * v.zoom > size.w - pad) x -= screenX + CARD_W * v.zoom - (size.w - pad);
      if (screenY < pad) y += pad - screenY;
      if (screenY > size.h - pad * 4) y -= screenY - (size.h - pad * 4);
      return { ...v, x, y };
    });
  }

  // focus moving to a card off screen brings it into view
  function onFocus(event: React.FocusEvent<HTMLDivElement>) {
    const id = (event.target as HTMLElement).closest<HTMLElement>("[data-canvas-card]")?.dataset
      .canvasCard;
    const box = id ? byId.get(id) : undefined;
    if (!box || gesture.current) return;
    const shown = visibleWorld(view, size);
    const inside =
      box.x >= shown.x &&
      box.y >= shown.y &&
      box.x + box.w <= shown.x + shown.w &&
      box.y <= shown.y + shown.h - 80;
    if (!inside)
      setView((v) => ({
        ...v,
        x: size.w / 2 - (box.x + box.w / 2) * v.zoom,
        y: 48 - box.y * v.zoom,
      }));
  }

  useEffect(() => {
    const id = reveal.current;
    const box = id ? byId.get(id) : undefined;
    if (!box) return;
    reveal.current = null;
    const shownNow = visibleWorld(view, size);
    const inside =
      box.x >= shownNow.x &&
      box.y >= shownNow.y &&
      box.x + box.w <= shownNow.x + shownNow.w &&
      box.y + 80 <= shownNow.y + shownNow.h;

    if (!inside)
      setView((v) => ({
        ...v,
        x: size.w / 2 - (box.x + box.w / 2) * v.zoom,
        y: 48 - box.y * v.zoom,
      }));
  }, [byId, view, size]);

  // ---- render ---------------------------------------------------------------------------------

  const shown = visibleWorld(view, size);
  const drawn = useMemo(() => {
    const placed: CardBox[] = boxes.map((b) =>
      drag && b.id === drag.id ? { ...b, x: drag.x, y: drag.y } : b,
    );
    const list = placed.length >= CULL_FROM ? visibleBoxes(placed, shown) : placed;
    // keep the dragged and focused cards mounted even when culled
    const order = readingOrder(list);
    const at = new Map(list.map((b) => [b.id, b]));
    return order.map((id) => at.get(id)!);
  }, [boxes, drag, shown]);

  const gridSize = GRID * view.zoom;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- pointer pan/zoom surface; the keyboard path is the zoom buttons, shortcuts and alt+arrows on focused cards
    <div
      ref={shell}
      className="canvas"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onClickCapture={(event) => {
        if (swallowClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onContextMenu={(event) => {
        // a long press on a phone is a drag here, not the system menu
        if (gesture.current) event.preventDefault();
      }}
      style={
        {
          "--grid-size": `${gridSize}px`,
          "--grid-x": `${view.x}px`,
          "--grid-y": `${view.y}px`,
        } as React.CSSProperties
      }
    >
      <div
        className="canvas__world"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <ul className="canvas__cards" aria-label={label}>
          {drawn.map((box) => {
            const note = noteById.get(box.id);
            if (!note) return null;
            const dragging = drag?.id === box.id;
            return (
              <li
                key={box.id}
                ref={measureCard}
                data-canvas-card={box.id}
                className={[
                  "canvas__card",
                  dragging && "canvas__card--dragging",
                  note.pinned && "canvas__card--pinned",
                  dimmed(note) && "canvas__card--dim",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ transform: `translate(${box.x}px, ${box.y}px)`, width: CARD_W }}
              >
                {renderCard(note)}
              </li>
            );
          })}
        </ul>
        {overlay?.(view)}
      </div>

      <div className="canvas__zoom" data-canvas-ui="" role="group" aria-label={t("canvas.zoom")}>
        {tools?.(() => {
          const shownNow = visibleWorld(view, size);
          return { x: shownNow.x + shownNow.w / 2, y: shownNow.y + shownNow.h / 2 };
        })}
        <button
          type="button"
          className="canvas__zoom-btn"
          aria-label={t("canvas.zoom_out")}
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          <Minus size={18} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="canvas__zoom-btn canvas__zoom-level sc-mono"
          aria-label={t("canvas.zoom_reset")}
          onClick={reset}
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button
          type="button"
          className="canvas__zoom-btn"
          aria-label={t("canvas.zoom_in")}
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <Plus size={18} strokeWidth={2.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="canvas__zoom-btn"
          aria-label={t("canvas.fit")}
          onClick={fit}
        >
          <Scan size={18} strokeWidth={2.6} aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}
