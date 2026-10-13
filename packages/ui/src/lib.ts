export type Accent = "yellow" | "lime" | "pink" | "blue" | "lilac" | "orange";
export type CardColor = Accent | "surface";

export const ACCENTS: readonly Accent[] = ["yellow", "lime", "pink", "blue", "lilac", "orange"];

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * Stable tilt index (1 to 4) for a note id, so a card always keeps its tilt.
 * FNV-1a over the id string.
 */
export function tiltIndex(id: string): 1 | 2 | 3 | 4 {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (((hash >>> 0) % 4) + 1) as 1 | 2 | 3 | 4;
}

/** CSS value for the tilt token a note id maps to. */
export function tiltFor(id: string): string {
  return `var(--tilt-${tiltIndex(id)})`;
}

/**
 * How much a big quote has to shrink so its longest unbreakable piece fits the card. Lines break
 * at spaces and after hyphens, so "organised-ish" counts as "organised-" and "ish". Undefined for
 * the full quote size.
 */
export function quoteFit(text: string): "sm" | "xs" | undefined {
  const pieces = text.split(/\s+/).flatMap((word) => word.split(/(?<=-)/));
  const longest = Math.max(0, ...pieces.map((piece) => piece.length));
  if (longest >= 13) return "xs";
  if (longest >= 9) return "sm";
  return undefined;
}
