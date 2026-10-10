export type BoardLayout = "cards" | "list";
const LAYOUT_KEY = "scraps.board.layout";

/** The layout choice is per device, kept in localStorage and guarded for private windows. */
export function readLayout(): BoardLayout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "cards";
  } catch {
    return "cards";
  }
}

export function writeLayout(layout: BoardLayout): void {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // not persisted; the choice still applies for this visit
  }
}
