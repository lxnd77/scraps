import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type { Database, Json } from "./types";
export * from "./schemas";
export { uuidv7 } from "./uuid";
import type { SpaceColor } from "./schemas";

export type Db = SupabaseClient<Database>;
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type SpaceRow = Database["public"]["Tables"]["spaces"]["Row"];
export type SpaceRole = "owner" | "editor" | "viewer";

export interface SpaceSummary {
  id: string;
  name: string;
  color: SpaceColor;
  iconSticker: string | null;
  role: SpaceRole;
  noteCount: number;
  createdAt: string;
}

export async function getProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Spaces the user belongs to, oldest first, with their own role and the live note count.
 * Filters on userId because the members policy also lets you read your co-members' rows.
 */
export async function listSpaces(db: Db, userId: string): Promise<SpaceSummary[]> {
  const [members, counts] = await Promise.all([
    db
      .from("space_members")
      .select("role, spaces!inner(id, name, color, icon_sticker, created_at, deleted_at)")
      .eq("user_id", userId)
      .is("spaces.deleted_at", null),
    db.rpc("space_note_counts"),
  ]);
  if (members.error) throw members.error;
  if (counts.error) throw counts.error;

  const countBySpace = new Map(counts.data.map((row) => [row.space_id, Number(row.note_count)]));
  return members.data
    .map((row) => ({
      id: row.spaces.id,
      name: row.spaces.name,
      color: row.spaces.color as SpaceColor,
      iconSticker: row.spaces.icon_sticker,
      role: row.role as SpaceRole,
      noteCount: countBySpace.get(row.spaces.id) ?? 0,
      createdAt: row.spaces.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export type NoteKind = "text" | "list" | "pic" | "link" | "voice" | "quote";
export const NOTE_KINDS: readonly NoteKind[] = ["text", "list", "pic", "link", "voice", "quote"];

/** The card preview the collab server derives (SPEC 8.3). Fields are optional by kind. */
export interface NotePreviewJson {
  checklist?: { done: number; total: number; items: Array<{ text: string; done: boolean }> };
  images?: string[];
  link?: { url: string; title?: string; domain?: string; image?: string; duration?: number };
  voice?: { assetId: string; durationMs?: number; excerpt?: string };
  quote?: string;
}

export interface NoteSummary {
  id: string;
  spaceId: string;
  title: string;
  previewText: string;
  kind: NoteKind;
  color: string;
  pinned: boolean;
  wordCount: number;
  updatedAt: string;
  preview: NotePreviewJson;
}

export const BOARD_PAGE_SIZE = 40;

const NOTE_COLUMNS =
  "id, space_id, title, preview_text, kind, color, pinned, word_count, updated_at, preview";

type NoteRowLike = {
  id: string;
  space_id: string;
  title: string;
  preview_text: string;
  kind: string;
  color: string;
  pinned: boolean;
  word_count: number;
  updated_at: string;
  preview: unknown;
};

function toSummary(row: NoteRowLike): NoteSummary {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    previewText: row.preview_text,
    kind: row.kind as NoteKind,
    color: row.color,
    pinned: row.pinned,
    wordCount: row.word_count,
    updatedAt: row.updated_at,
    preview: (row.preview ?? {}) as NotePreviewJson,
  };
}

export interface NotesPage {
  notes: NoteSummary[];
  /** the page number to ask for next, or null at the end */
  nextPage: number | null;
}

/**
 * One page of a space's board: pinned first, then most recently edited (SPEC 6.1).
 * Offset paging is fine at this size; a note edited between pages can shift by one.
 */
export async function listNotesPage(
  db: Db,
  spaceId: string,
  options: { kind?: NoteKind | null; page?: number } = {},
): Promise<NotesPage> {
  const page = options.page ?? 0;
  let query = db
    .from("notes")
    .select(NOTE_COLUMNS)
    .eq("space_id", spaceId)
    .is("deleted_at", null);
  if (options.kind) query = query.eq("kind", options.kind);
  const from = page * BOARD_PAGE_SIZE;
  // one extra row tells us whether another page exists
  const { data, error } = await query
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + BOARD_PAGE_SIZE);
  if (error) throw error;
  const hasMore = data.length > BOARD_PAGE_SIZE;
  return {
    notes: data.slice(0, BOARD_PAGE_SIZE).map(toSummary),
    nextPage: hasMore ? page + 1 : null,
  };
}

/** Scraps per kind in a space, for the filter chips. */
export async function kindCounts(db: Db, spaceId: string): Promise<Record<NoteKind, number>> {
  const { data, error } = await db.rpc("space_kind_counts", { p_space: spaceId });
  if (error) throw error;
  const counts: Record<NoteKind, number> = {
    text: 0,
    list: 0,
    pic: 0,
    link: 0,
    voice: 0,
    quote: 0,
  };
  for (const row of data) {
    if (row.kind in counts) counts[row.kind as NoteKind] = Number(row.note_count);
  }
  return counts;
}

export interface SearchHit {
  id: string;
  title: string;
  kind: NoteKind;
  color: string;
  spaceId: string;
  pinned: boolean;
  /** match markers are `<<` and `>>` */
  snippet: string;
  updatedAt: string;
}

export async function searchNotes(db: Db, query: string, limit = 20): Promise<SearchHit[]> {
  const { data, error } = await db.rpc("search_notes", { p_query: query, p_limit: limit });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind as NoteKind,
    color: row.color,
    spaceId: row.space_id,
    pinned: row.pinned,
    snippet: row.snippet,
    updatedAt: row.updated_at,
  }));
}

export interface Streak {
  streak: number;
  activeToday: boolean;
}

export async function getStreak(db: Db): Promise<Streak> {
  const { data, error } = await db.rpc("current_streak");
  if (error) throw error;
  const row = data[0];
  return { streak: row?.streak ?? 0, activeToday: row?.active_today ?? false };
}

/** Notes in a space for the board: first page only. */
export async function listNotes(db: Db, spaceId: string): Promise<NoteSummary[]> {
  return (await listNotesPage(db, spaceId)).notes;
}

export interface NoteTag {
  id: string;
  name: string;
  color: SpaceColor;
}

export interface NoteDetail {
  id: string;
  spaceId: string;
  title: string;
  color: string;
  pinned: boolean;
  props: { vibe?: string; when?: string };
  tags: NoteTag[];
}

/** One note with its tags, or null when it does not exist or RLS hides it. */
export async function getNote(db: Db, noteId: string): Promise<NoteDetail | null> {
  const { data, error } = await db
    .from("notes")
    .select(
      "id, space_id, title, color, pinned, props, deleted_at, note_tags(tags(id, name, color))",
    )
    .eq("id", noteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const props = (data.props ?? {}) as { vibe?: unknown; when?: unknown };
  return {
    id: data.id,
    spaceId: data.space_id,
    title: data.title,
    color: data.color,
    pinned: data.pinned,
    props: {
      vibe: typeof props.vibe === "string" ? props.vibe : undefined,
      when: typeof props.when === "string" ? props.when : undefined,
    },
    tags: (data.note_tags ?? []).flatMap((nt) =>
      nt.tags ? [{ id: nt.tags.id, name: nt.tags.name, color: nt.tags.color as SpaceColor }] : [],
    ),
  };
}

/** Every tag in a space, for the add-tag suggestions. */
export async function listSpaceTags(db: Db, spaceId: string): Promise<NoteTag[]> {
  const { data, error } = await db
    .from("tags")
    .select("id, name, color")
    .eq("space_id", spaceId)
    .order("name");
  if (error) throw error;
  return data.map((row) => ({ id: row.id, name: row.name, color: row.color as SpaceColor }));
}
