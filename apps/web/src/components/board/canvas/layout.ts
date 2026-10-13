import type { BoardPos, NoteSummary } from "@scraps/db";

/** One grid cell in world pixels. Cards snap to it; stickers do not. */
export const GRID = 24;
/** Cards are a fixed width on the canvas: 12 cells. */
export const CARD_CELLS = 12;
export const CARD_W = CARD_CELLS * GRID;
/** Columns of the block that unplaced cards flow into. Fixed, so everyone sees the same board. */
export const FLOW_COLUMNS = 4;
const GAP_CELLS = 1;

/** A card's box on the canvas, in world pixels. */
export interface CardBox {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** false while it only flows (no board_pos stored yet) */
  placed: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pixels to the nearest whole cell. */
export function snap(px: number): number {
  return Math.round(px / GRID);
}

/** A first guess at a card's height before it has rendered, by kind. */
export function estimateHeight(note: Pick<NoteSummary, "kind" | "preview">): number {
  switch (note.kind) {
    case "pic":
      return 300;
    case "link":
      return 260;
    case "voice":
      return 200;
    case "list":
      return 120 + Math.min(note.preview.checklist?.items.length ?? 3, 5) * 34;
    case "quote":
      return 180;
    default:
      return 190;
  }
}

/**
 * Where every card goes. Placed cards sit at their stored cell. The rest flow, in the order given
 * (pinned first, then most recent), into a fixed masonry block under the placed ones, so an
 * untouched space looks like the old board and a new scrap from elsewhere lands below.
 */
export function layoutBoard(
  notes: ReadonlyArray<Pick<NoteSummary, "id" | "kind" | "preview" | "boardPos">>,
  heights: ReadonlyMap<string, number>,
): CardBox[] {
  const out: CardBox[] = [];
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  const placed: CardBox[] = [];
  for (const note of notes) {
    if (!note.boardPos) continue;
    const h = heights.get(note.id) ?? estimateHeight(note);
    const x = note.boardPos.x * GRID;
    placed.push({ id: note.id, x, y: note.boardPos.y * GRID, w: CARD_W, h, placed: true });
  }
  for (const box of settle(placed)) {
    out.push(box);
    bottom = Math.max(bottom, box.y + box.h);
    left = Math.min(left, box.x);
  }

  const startY = Number.isFinite(bottom) ? Math.ceil(bottom / GRID + 2 * GAP_CELLS) * GRID : 0;
  const startX = Number.isFinite(left) ? left : 0;
  const columns = new Array<number>(FLOW_COLUMNS).fill(startY);
  for (const note of notes) {
    if (note.boardPos) continue;
    const h = heights.get(note.id) ?? estimateHeight(note);
    let col = 0;
    for (let c = 1; c < FLOW_COLUMNS; c++) if (columns[c]! < columns[col]!) col = c;
    const y = columns[col]!;
    out.push({
      id: note.id,
      x: startX + col * (CARD_CELLS + GAP_CELLS) * GRID,
      y,
      w: CARD_W,
      h,
      placed: false,
    });
    columns[col] = Math.ceil((y + h) / GRID + GAP_CELLS) * GRID;
  }
  return out;
}

/**
 * Cards never cover each other. Top to bottom (then left to right), a card that meets one already
 * settled drops to the next cell under it. Only what is drawn moves: stored cells stay as they are,
 * so a card that grew (a longer list) or was dropped on another pushes the next one down instead
 * of hiding it.
 */
function settle(boxes: CardBox[]): CardBox[] {
  const order = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x || (a.id < b.id ? -1 : 1));
  const done: CardBox[] = [];
  for (const box of order) {
    let y = box.y;
    for (;;) {
      const r = { ...box, y };
      const hits = done.filter((d) => overlaps(r, d));
      if (hits.length === 0) break;
      y = Math.ceil(Math.max(...hits.map((d) => d.y + d.h)) / GRID + GAP_CELLS) * GRID;
    }
    done.push(y === box.y ? box : { ...box, y });
  }
  const byId = new Map(done.map((b) => [b.id, b]));
  return boxes.map((b) => byId.get(b.id)!);
}

/** Every card's current cell, for freezing a flowed layout the first time someone drags. */
export function freezePositions(boxes: readonly CardBox[]): Array<{ id: string } & BoardPos> {
  return boxes.map((b) => ({ id: b.id, x: snap(b.x), y: snap(b.y) }));
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The free cell nearest `near` (world px) for a new card of height `h`: rings of cells around the
 * point, checked against every card with a one-cell margin. Falls back to the point itself.
 */
export function freeSpot(
  boxes: readonly CardBox[],
  near: { x: number; y: number },
  h = 200,
  /** look here first, reading order from its top left (the part of the board on screen) */
  within?: Rect,
): BoardPos {
  const origin = { x: snap(near.x), y: snap(near.y) };
  const margin = GAP_CELLS * GRID;
  const fits = (cx: number, cy: number) => {
    const r = {
      x: cx * GRID - margin,
      y: cy * GRID - margin,
      w: CARD_W + 2 * margin,
      h: h + 2 * margin,
    };
    return !boxes.some((b) => overlaps(r, b));
  };
  if (within) {
    const x0 = Math.ceil(within.x / GRID);
    const y0 = Math.ceil(within.y / GRID);
    const x1 = Math.floor((within.x + within.w - CARD_W) / GRID);
    const y1 = Math.floor((within.y + within.h - Math.min(h, within.h)) / GRID);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) if (fits(cx, cy)) return { x: cx, y: cy };
    }
  }
  for (let ring = 0; ring <= 60; ring++) {
    // on each ring, below and to the right of the point come first (that is where you look next)
    const cells: Array<[number, number]> = [];
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === ring) cells.push([dx, dy]);
      }
    }
    cells.sort(
      (a, b) => Number(a[1] < 0) - Number(b[1] < 0) || Number(a[0] < 0) - Number(b[0] < 0),
    );
    for (const [dx, dy] of cells) {
      if (fits(origin.x + dx, origin.y + dy)) return { x: origin.x + dx, y: origin.y + dy };
    }
  }
  return origin;
}

/** Cards whose box meets the view (world px) grown by `margin`, for rendering only those. */
export function visibleBoxes(boxes: readonly CardBox[], view: Rect, margin = 400): CardBox[] {
  const grown = {
    x: view.x - margin,
    y: view.y - margin,
    w: view.w + 2 * margin,
    h: view.h + 2 * margin,
  };
  return boxes.filter((b) => overlaps(grown, b));
}

/** The box around every card, or null on an empty board. */
export function boundsOf(boxes: readonly Rect[]): Rect | null {
  if (boxes.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const b of boxes) {
    x1 = Math.min(x1, b.x);
    y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.w);
    y2 = Math.max(y2, b.y + b.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/**
 * Reading order for keyboard focus and screen readers: top to bottom in bands of half a card,
 * then left to right, so cards side by side read across.
 */
export function readingOrder(boxes: readonly CardBox[]): string[] {
  const band = (b: CardBox) => Math.floor(b.y / (CARD_W / 2));
  return [...boxes].sort((a, b) => band(a) - band(b) || a.x - b.x || a.y - b.y).map((b) => b.id);
}
