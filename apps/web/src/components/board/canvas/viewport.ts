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
