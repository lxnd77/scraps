import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type { Database, Json } from "./types";
export * from "./schemas";
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
