import { describe, expect, it } from "vitest";
import {
  boundsOf,
  CARD_CELLS,
  CARD_W,
  freeSpot,
  freezePositions,
  GRID,
  layoutBoard,
  readingOrder,
  snap,
  visibleBoxes,
} from "./layout";

const note = (id: string, boardPos: { x: number; y: number } | null = null) => ({
  id,
  kind: "text" as const,
  preview: {},
  boardPos,
});
const heights = new Map<string, number>();

describe("canvas layout", () => {
  it("snaps to the nearest cell", () => {
    expect(snap(0)).toBe(0);
    expect(snap(11)).toBe(0);
    expect(snap(13)).toBe(1);
    expect(snap(-37)).toBe(-2);
  });

  it("flows an untouched board into four columns from the origin", () => {
    const boxes = layoutBoard([note("a"), note("b"), note("c"), note("d"), note("e")], heights);
    expect(boxes.map((b) => b.x)).toEqual([0, 312, 624, 936, 0]);
    expect(boxes.slice(0, 4).every((b) => b.y === 0)).toBe(true);
    expect(boxes[4]!.y).toBeGreaterThan(0);
    expect(boxes.every((b) => !b.placed)).toBe(true);
  });

  it("is the same for everyone, whatever the screen", () => {
    const notes = [note("a"), note("b", { x: 10, y: 4 }), note("c")];
    expect(layoutBoard(notes, heights)).toEqual(layoutBoard(notes, heights));
  });

  it("puts placed cards at their cell and flows the rest below them", () => {
    const boxes = layoutBoard([note("a", { x: 5, y: 2 }), note("b")], new Map([["a", 200]]));
    const a = boxes.find((b) => b.id === "a")!;
    const b = boxes.find((b) => b.id === "b")!;
    expect([a.x, a.y, a.placed]).toEqual([5 * GRID, 2 * GRID, true]);
    expect(b.y).toBeGreaterThanOrEqual(a.y + 200);
    expect(b.x).toBe(a.x);
  });

  it("never draws a card over another: the lower one drops under it", () => {
    // a picture at row 3 is taller than the 8 rows to the next picture (stored by an older layout)
    const boxes = layoutBoard(
      [note("top", { x: 0, y: 3 }), note("under", { x: 0, y: 11 }), note("aside", { x: 13, y: 4 })],
      new Map([
        ["top", 300],
        ["under", 300],
        ["aside", 100],
      ]),
    );
    const top = boxes.find((b) => b.id === "top")!;
    const under = boxes.find((b) => b.id === "under")!;
    const aside = boxes.find((b) => b.id === "aside")!;
    expect(top.y).toBe(3 * GRID);
    expect(under.y).toBe(Math.ceil((top.y + 300) / GRID + 1) * GRID);
    // a card beside it, in another column, stays where it is
    expect(aside.y).toBe(4 * GRID);
    // the order of the boxes follows the notes, whatever moved
    expect(boxes.map((b) => b.id)).toEqual(["top", "under", "aside"]);
  });

  it("pushes a whole chain down and flows unplaced cards below the settled ones", () => {
    const boxes = layoutBoard(
      [note("a", { x: 0, y: 0 }), note("b", { x: 0, y: 2 }), note("c", { x: 0, y: 4 }), note("d")],
      new Map([
        ["a", 240],
        ["b", 240],
        ["c", 240],
        ["d", 100],
      ]),
    );
    const [a, b, c, d] = boxes;
    expect(b!.y).toBeGreaterThanOrEqual(a!.y + a!.h);
    expect(c!.y).toBeGreaterThanOrEqual(b!.y + b!.h);
    expect(d!.y).toBeGreaterThanOrEqual(c!.y + c!.h);
  });

  it("freezes the flowed layout as whole cells", () => {
    const boxes = layoutBoard([note("a"), note("b")], heights);
    expect(freezePositions(boxes)).toEqual([
      { id: "a", x: 0, y: 0 },
      { id: "b", x: CARD_CELLS + 1, y: 0 },
    ]);
  });

  it("finds a free spot next to a card in the way", () => {
    const boxes = layoutBoard([note("a", { x: 0, y: 0 })], new Map([["a", 200]]));
    const spot = freeSpot(boxes, { x: 0, y: 0 }, 200);
    const r = { x: spot.x * GRID, y: spot.y * GRID, w: CARD_W, h: 200 };
    const a = boxes[0]!;
    const clear = r.x >= a.x + a.w || r.x + r.w <= a.x || r.y >= a.y + a.h || r.y + r.h <= a.y;
    expect(clear).toBe(true);
    expect(freeSpot([], { x: 50, y: 50 })).toEqual({ x: 2, y: 2 });
    // with a view to fill, the first free cell in reading order inside it
    const view = { x: 0, y: 0, w: 2000, h: 1000 };
    expect(freeSpot(boxes, view, 200, view)).toEqual({ x: CARD_CELLS + 1, y: 0 });
  });

  it("renders only what is near the view", () => {
    const boxes = layoutBoard(
      [note("near", { x: 0, y: 0 }), note("far", { x: 2000, y: 2000 })],
      heights,
    );
    expect(visibleBoxes(boxes, { x: 0, y: 0, w: 1000, h: 800 }).map((b) => b.id)).toEqual(["near"]);
  });

  it("measures the board and reads it across, then down", () => {
    expect(boundsOf([])).toBeNull();
    const boxes = layoutBoard(
      [
        note("right", { x: 20, y: 0 }),
        note("left", { x: 0, y: 1 }),
        note("below", { x: 0, y: 30 }),
      ],
      heights,
    );
    expect(readingOrder(boxes)).toEqual(["left", "right", "below"]);
    expect(boundsOf(boxes)).toMatchObject({ x: 0, y: 0, w: 20 * GRID + CARD_W });
  });
});
