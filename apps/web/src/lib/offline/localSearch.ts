import type { NoteSummary, SearchHit } from "@scraps/db";

/** Words typed by the user, lowercased, empty ones dropped. */
function terms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Every piece of text a card knows about, in the order a reader would weigh it. */
function haystacks(note: NoteSummary): string[] {
  return [
    note.title,
    note.previewText,
    ...(note.preview.checklist?.items.map((i) => i.text) ?? []),
    note.preview.quote ?? "",
    note.preview.link?.title ?? "",
    note.preview.link?.description ?? "",
  ].filter(Boolean);
}

/** A short snippet around the first match, with the match wrapped in the `<<` `>>` markers. */
function snippetFor(text: string, matchTerms: string[]): string {
  const lower = text.toLowerCase();
  let at = -1;
  let length = 0;
  for (const term of matchTerms) {
    const i = lower.indexOf(term);
    if (i !== -1 && (at === -1 || i < at)) {
      at = i;
      length = term.length;
    }
  }
  if (at === -1) return text.slice(0, 80);
  const from = Math.max(0, at - 30);
  const to = Math.min(text.length, at + length + 50);
  return `${from > 0 ? "…" : ""}${text.slice(from, at)}<<${text.slice(at, at + length)}>>${text.slice(at + length, to)}${to < text.length ? "…" : ""}`;
}

/**
 * Search over the notes cached on this device (SPEC 9.8, offline): every word must appear
 * somewhere in the card's title, preview text or checklist items. Title matches rank first, then
 * most recently edited.
 */
export function searchLocal(notes: NoteSummary[], query: string, limit = 20): SearchHit[] {
  const words = terms(query);
  if (words.length === 0) return [];

  const scored: Array<{ note: NoteSummary; titleHit: boolean; snippet: string }> = [];
  const seen = new Set<string>();
  for (const note of notes) {
    if (seen.has(note.id)) continue;
    seen.add(note.id);
    const texts = haystacks(note);
    const joined = texts.join(" \n ").toLowerCase();
    if (!words.every((w) => joined.includes(w))) continue;
    const titleHit = words.every((w) => note.title.toLowerCase().includes(w));
    const best = texts.find((t) => words.some((w) => t.toLowerCase().includes(w))) ?? note.title;
    scored.push({ note, titleHit, snippet: snippetFor(best, words) });
  }

  scored.sort(
    (a, b) =>
      Number(b.titleHit) - Number(a.titleHit) || b.note.updatedAt.localeCompare(a.note.updatedAt),
  );
  return scored.slice(0, limit).map(({ note, snippet }) => ({
    id: note.id,
    title: note.title,
    kind: note.kind,
    color: note.color,
    spaceId: note.spaceId,
    pinned: note.pinned,
    snippet,
    updatedAt: note.updatedAt,
  }));
}
