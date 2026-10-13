import type { Rect } from "./layout";

/**
 * Pan and zoom of a canvas. A world point p shows on screen (relative to the canvas element) at
 * p * zoom + {x, y}.
 */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
/** Breathing room between the canvas edge and the cards at 100%. */
export const HOME: Viewport = { x: 24, y: 24, zoom: 1 };

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(view: Viewport, p: { x: number; y: number }) {
  return { x: (p.x - view.x) / view.zoom, y: (p.y - view.y) / view.zoom };
}

/** The part of the world the canvas shows, for culling and placing new cards. */
export function visibleWorld(view: Viewport, size: { w: number; h: number }): Rect {
  const tl = screenToWorld(view, { x: 0, y: 0 });
  return { x: tl.x, y: tl.y, w: size.w / view.zoom, h: size.h / view.zoom };
}

/** Zooms to `zoom` keeping the world point under `at` (screen px) where it is. */
export function zoomAt(view: Viewport, zoom: number, at: { x: number; y: number }): Viewport {
  const next = clampZoom(zoom);
  const world = screenToWorld(view, at);
  return { zoom: next, x: at.x - world.x * next, y: at.y - world.y * next };
}

/** A view that shows all of `bounds` with a margin, never zoomed past 100%. */
export function fitTo(bounds: Rect | null, size: { w: number; h: number }, margin = 32): Viewport {
  if (!bounds || size.w <= 0 || size.h <= 0) return HOME;
  const zoom = clampZoom(
    Math.min(1, (size.w - 2 * margin) / bounds.w, (size.h - 2 * margin) / bounds.h),
  );
  return {
    zoom,
    x: (size.w - bounds.w * zoom) / 2 - bounds.x * zoom,
    y: Math.max(margin, (size.h - bounds.h * zoom) / 2) - bounds.y * zoom,
  };
}

const key = (spaceId: string) => `scraps.view.${spaceId}`;

/** The last view of a space on this device, if it was remembered. */
export function readViewport(spaceId: string): Viewport | null {
  try {
    const raw = window.localStorage.getItem(key(spaceId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Viewport>;
    if ([v.x, v.y, v.zoom].every((n) => typeof n === "number" && Number.isFinite(n))) {
      return { x: v.x!, y: v.y!, zoom: clampZoom(v.zoom!) };
    }
  } catch {
    // storage blocked or junk: start from home
  }
  return null;
}

export function writeViewport(spaceId: string, view: Viewport): void {
  try {
    window.localStorage.setItem(key(spaceId), JSON.stringify(view));
  } catch {
    // not remembered; harmless
  }
}

/**
 * Keeps at least `keep` px of the board on screen on every side, so panning (wheel, drag, pinch)
 * can never send every card away. With no cards there is nothing to keep.
 */
export function clampView(
  view: Viewport,
  bounds: Rect | null,
  size: { w: number; h: number },
  keep = 120,
): Viewport {
  if (!bounds || size.w <= 0 || size.h <= 0) return view;
  const left = bounds.x * view.zoom + view.x;
  const right = (bounds.x + bounds.w) * view.zoom + view.x;
  const top = bounds.y * view.zoom + view.y;
  const bottom = (bounds.y + bounds.h) * view.zoom + view.y;
  const kx = Math.min(keep, (right - left) / 2, size.w / 2);
  const ky = Math.min(keep, (bottom - top) / 2, size.h / 2);
  let { x, y } = view;
  if (right < kx) x += kx - right;
  else if (left > size.w - kx) x -= left - (size.w - kx);
  if (bottom < ky) y += ky - bottom;
  else if (top > size.h - ky) y -= top - (size.h - ky);
  return x === view.x && y === view.y ? view : { ...view, x, y };
}

/**
 * The smallest pan that shows a card clear of the edges and of a toolbar along the bottom: all of
 * it when it fits, else its head (its first `head` px); the view itself when it already shows. A card wider than the view
 * lines up on its leading edge.
 */
export function panToShow(
  view: Viewport,
  box: Rect,
  size: { w: number; h: number },
  options: { pad?: number; top?: number; bottom?: number; head?: number } = {},
): Viewport {
  const pad = options.pad ?? 16;
  const topEdge = options.top ?? pad;
  const bottom = options.bottom ?? 72;
  // the whole card when it fits between the edges, else its head (title and "more" button)
  const room = size.h - topEdge - bottom;
  const whole = box.h * view.zoom;
  const head = whole <= room ? whole : Math.min(box.h, options.head ?? 120) * view.zoom;
  const left = box.x * view.zoom + view.x;
  const right = (box.x + box.w) * view.zoom + view.x;
  const top = box.y * view.zoom + view.y;
  let { x, y } = view;
  if (right - left > size.w - 2 * pad || left < pad) x += pad - left;
  else if (right > size.w - pad) x -= right - (size.w - pad);
  if (top < topEdge) y += topEdge - top;
  else if (top + head > size.h - bottom) y -= top + head - (size.h - bottom);
  return x === view.x && y === view.y ? view : { ...view, x, y };
}
