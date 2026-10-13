import type { CopyKey } from "@/copy/en";

/**
 * App-wide single-key shortcuts for desktop (the editor's own formatting keys live in Tiptap).
 * Matching is pure so it can be tested; ShortcutsProvider runs the actions.
 */
export type ShortcutAction =
  | { type: "help" }
  | { type: "search" }
  | { type: "theme" }
  | { type: "go"; to: "home" | "spaces" | "lists" | "settings" | "trash" }
  | { type: "space"; index: number }
  | { type: "space-step"; by: 1 | -1 }
  | { type: "canvas"; command: "zoom-in" | "zoom-out" | "zoom-reset" | "fit" }
  | { type: "leave-editor" }
  | { type: "back-to-space" };

export interface KeyInput {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** focus is in a text field or the editor */
  typing: boolean;
  /** focus is in the editor itself */
  inEditor: boolean;
  /** a dialog or menu is open and owns the keyboard */
  modal: boolean;
  /** on a scrap's page */
  onNote: boolean;
}

/** How long "g" waits for its second key. */
export const SEQUENCE_MS = 1200;

const GO: Record<string, "home" | "spaces" | "lists" | "settings" | "trash"> = {
  h: "home",
  s: "spaces",
  l: "lists",
  ",": "settings",
  t: "trash",
};

/**
 * What a key press means. `pending` is "g" when the previous key started a sequence. Returns the
 * action (or null) and the new pending key.
 */
export function matchShortcut(
  input: KeyInput,
  pending: string | null,
): { action: ShortcutAction | null; pending: string | null } {
  const none = { action: null, pending: null };
  if (input.key === "Escape") {
    if (input.modal) return none;
    if (input.inEditor) return { action: { type: "leave-editor" }, pending: null };
    if (input.onNote && !input.typing) return { action: { type: "back-to-space" }, pending: null };
    return none;
  }
  if (input.typing || input.modal || input.ctrlKey || input.metaKey || input.altKey) return none;

  const key = input.key.length === 1 ? input.key.toLowerCase() : input.key;
  if (pending === "g") {
    const to = GO[key];
    return to ? { action: { type: "go", to }, pending: null } : none;
  }
  switch (key) {
    case "g":
      return { action: null, pending: "g" };
    case "?":
      return { action: { type: "help" }, pending: null };
    case "/":
      return { action: { type: "search" }, pending: null };
    case "t":
      return { action: { type: "theme" }, pending: null };
    case "[":
      return { action: { type: "space-step", by: -1 }, pending: null };
    case "]":
      return { action: { type: "space-step", by: 1 }, pending: null };
    // zoom on a board (the canvas ignores them anywhere else); = is + without shift
    case "+":
    case "=":
      return { action: { type: "canvas", command: "zoom-in" }, pending: null };
    case "-":
      return { action: { type: "canvas", command: "zoom-out" }, pending: null };
    case "0":
      return { action: { type: "canvas", command: "zoom-reset" }, pending: null };
    case "f":
      return { action: { type: "canvas", command: "fit" }, pending: null };
  }
  if (/^[1-9]$/.test(key))
    return { action: { type: "space", index: Number(key) - 1 }, pending: null };
  return none;
}

/** The cheat sheet. Keys are shown as written; "mod" becomes ctrl or cmd. */
export const SHORTCUT_GROUPS: Array<{
  title: CopyKey;
  items: Array<{ keys: string[]; label: CopyKey }>;
}> = [
  {
    title: "keys.group.anywhere",
    items: [
      { keys: ["n"], label: "keys.new" },
      { keys: ["/"], label: "keys.search" },
      { keys: ["mod", "k"], label: "keys.search" },
      { keys: ["t"], label: "keys.theme" },
      { keys: ["?"], label: "keys.help" },
    ],
  },
  {
    title: "keys.group.go",
    items: [
      { keys: ["g", "h"], label: "keys.go.home" },
      { keys: ["g", "s"], label: "keys.go.spaces" },
      { keys: ["g", "l"], label: "keys.go.lists" },
      { keys: ["g", ","], label: "keys.go.settings" },
      { keys: ["g", "t"], label: "keys.go.trash" },
      { keys: ["1", "…", "9"], label: "keys.space.n" },
      { keys: ["[", "]"], label: "keys.space.step" },
    ],
  },
  {
    title: "keys.group.board",
    items: [
      { keys: ["←", "→"], label: "keys.board.move" },
      { keys: ["enter"], label: "keys.board.open" },
      { keys: ["p"], label: "keys.board.pin" },
      { keys: ["alt", "←", "→"], label: "keys.board.nudge" },
      { keys: ["m"], label: "keys.board.move_space" },
      { keys: ["+"], label: "keys.zoom.in" },
      { keys: ["-"], label: "keys.zoom.out" },
      { keys: ["0"], label: "keys.zoom.reset" },
      { keys: ["f"], label: "keys.zoom.fit" },
      { keys: ["."], label: "keys.board.menu" },
    ],
  },
  {
    title: "keys.group.scrap",
    items: [
      { keys: ["/"], label: "keys.scrap.block" },
      { keys: ["esc"], label: "keys.scrap.leave" },
      { keys: ["mod", "b"], label: "keys.scrap.bold" },
      { keys: ["mod", "i"], label: "keys.scrap.italic" },
      { keys: ["mod", "shift", "h"], label: "keys.scrap.highlight" },
      { keys: ["mod", "shift", "9"], label: "keys.scrap.checklist" },
      { keys: ["mod", "z"], label: "keys.scrap.undo" },
    ],
  },
];
