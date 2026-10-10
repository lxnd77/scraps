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

export interface NoteSummary {
  id: string;
  title: string;
  previewText: string;
  kind: "text" | "list" | "pic" | "link" | "voice" | "quote";
  color: string;
  pinned: boolean;
  wordCount: number;
  updatedAt: string;
}

/** Notes in a space for the board: pinned first, then most recently edited (SPEC 6.1). */
export async function listNotes(db: Db, spaceId: string, limit = 100): Promise<NoteSummary[]> {
  const { data, error } = await db
    .from("notes")
    .select("id, title, preview_text, kind, color, pinned, word_count, updated_at")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    previewText: row.preview_text,
    kind: row.kind as NoteSummary["kind"],
    color: row.color,
    pinned: row.pinned,
    wordCount: row.word_count,
    updatedAt: row.updated_at,
  }));
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
