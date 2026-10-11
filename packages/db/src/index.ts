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
  imagePaths?: string[];
  imageCount?: number;
  link?: {
    url: string;
    title?: string;
    description?: string;
    domain?: string;
    image?: string;
    duration?: number;
    mediaType?: "article" | "video" | "maps";
  };
  voice?: {
    assetId: string;
    path?: string;
    durationMs?: number;
    peaks?: number[];
    excerpt?: string;
  };
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
  iconSticker: string | null;
}

export const BOARD_PAGE_SIZE = 40;

const NOTE_COLUMNS =
  "id, space_id, title, preview_text, kind, color, pinned, word_count, updated_at, preview, icon_sticker";

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
  icon_sticker: string | null;
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
    iconSticker: row.icon_sticker,
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
  let query = db.from("notes").select(NOTE_COLUMNS).eq("space_id", spaceId).is("deleted_at", null);
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

const COVER_ACCENTS = ["yellow", "lime", "pink", "blue", "lilac", "orange"] as const;
export type CoverAccent = (typeof COVER_ACCENTS)[number];

/** The page cover (SPEC 6.3): two-accent stripes, the night illustration, or an uploaded picture. */
export type NoteCover =
  | { type: "pattern"; a: CoverAccent; b: CoverAccent }
  | { type: "illustration" }
  | { type: "image"; path: string; color?: string };

export function parseCover(value: unknown): NoteCover | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const accent = (x: unknown): CoverAccent | null =>
    typeof x === "string" && (COVER_ACCENTS as readonly string[]).includes(x)
      ? (x as CoverAccent)
      : null;
  if (v.type === "pattern") {
    const a = accent(v.a);
    const b = accent(v.b);
    return a && b ? { type: "pattern", a, b } : null;
  }
  if (v.type === "illustration") return { type: "illustration" };
  if (v.type === "image" && typeof v.path === "string") {
    return {
      type: "image",
      path: v.path,
      color: typeof v.color === "string" ? v.color : undefined,
    };
  }
  return null;
}

export interface NoteDetail {
  id: string;
  spaceId: string;
  title: string;
  color: string;
  pinned: boolean;
  iconSticker: string | null;
  cover: NoteCover | null;
  wordCount: number;
  updatedAt: string;
  props: { vibe?: string; when?: string; accent?: CoverAccent };
  tags: NoteTag[];
}

/** One note with its tags, or null when it does not exist or RLS hides it. */
export async function getNote(db: Db, noteId: string): Promise<NoteDetail | null> {
  const { data, error } = await db
    .from("notes")
    .select(
      "id, space_id, title, color, pinned, props, icon_sticker, cover, word_count, updated_at, deleted_at, note_tags(tags(id, name, color))",
    )
    .eq("id", noteId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const props = (data.props ?? {}) as { vibe?: unknown; when?: unknown; accent?: unknown };
  return {
    id: data.id,
    spaceId: data.space_id,
    title: data.title,
    color: data.color,
    pinned: data.pinned,
    iconSticker: data.icon_sticker,
    cover: parseCover(data.cover),
    wordCount: data.word_count,
    updatedAt: data.updated_at,
    props: {
      vibe: typeof props.vibe === "string" ? props.vibe : undefined,
      when: typeof props.when === "string" ? props.when : undefined,
      accent: (COVER_ACCENTS as readonly unknown[]).includes(props.accent)
        ? (props.accent as CoverAccent)
        : undefined,
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

export * from "./ssrf";
export * from "./unfurl";

// ---- sharing (phase 5) ---------------------------------------------------------------------

export interface SpaceMember {
  userId: string;
  role: SpaceRole;
  displayName: string;
  avatarSticker: string;
  joinedAt: string;
}

export async function listSpaceMembers(db: Db, spaceId: string): Promise<SpaceMember[]> {
  const { data, error } = await db.rpc("list_space_members", { p_space: spaceId });
  if (error) throw error;
  return data.map((row) => ({
    userId: row.user_id,
    role: row.role as SpaceRole,
    displayName: row.display_name,
    avatarSticker: row.avatar_sticker,
    joinedAt: row.joined_at,
  }));
}

export interface MemberAvatar {
  spaceId: string;
  userId: string;
  displayName: string;
  avatarSticker: string;
}

/** Members of every space the caller is in, grouped by space id. */
export async function listMemberAvatars(db: Db): Promise<Record<string, MemberAvatar[]>> {
  const { data, error } = await db.rpc("space_member_avatars");
  if (error) throw error;
  const bySpace: Record<string, MemberAvatar[]> = {};
  for (const row of data) {
    (bySpace[row.space_id] ??= []).push({
      spaceId: row.space_id,
      userId: row.user_id,
      displayName: row.display_name,
      avatarSticker: row.avatar_sticker,
    });
  }
  return bySpace;
}

export interface InviteRow {
  id: string;
  role: "editor" | "viewer";
  expiresAt: string;
  maxUses: number;
  uses: number;
  createdBy: string;
}

/** Live invites of a space (not revoked, not expired, not used up). */
export async function listInvites(db: Db, spaceId: string): Promise<InviteRow[]> {
  const { data, error } = await db
    .from("space_invites")
    .select("id, role, expires_at, max_uses, uses, created_by")
    .eq("space_id", spaceId)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data
    .filter((row) => row.uses < row.max_uses)
    .map((row) => ({
      id: row.id,
      role: row.role as "editor" | "viewer",
      expiresAt: row.expires_at,
      maxUses: row.max_uses,
      uses: row.uses,
      createdBy: row.created_by,
    }));
}

export async function createInvite(
  db: Db,
  args: { spaceId: string; role: "editor" | "viewer"; days: number; maxUses: number },
): Promise<string> {
  const { data, error } = await db.rpc("create_invite", {
    p_space: args.spaceId,
    p_role: args.role,
    p_expires_in_days: args.days,
    p_max_uses: args.maxUses,
  });
  if (error) throw error;
  return data;
}

export async function revokeInvite(db: Db, inviteId: string): Promise<void> {
  const { error } = await db
    .from("space_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId);
  if (error) throw error;
}

export interface InvitePreview {
  spaceName: string;
  spaceColor: SpaceColor;
  role: "editor" | "viewer";
  inviterName: string;
  alreadyMember: boolean;
}

export async function previewInvite(db: Db, token: string): Promise<InvitePreview | null> {
  const { data, error } = await db.rpc("invite_preview", { p_token: token });
  if (error) throw error;
  const row = data[0];
  if (!row) return null;
  return {
    spaceName: row.space_name,
    spaceColor: row.space_color as SpaceColor,
    role: row.role as "editor" | "viewer",
    inviterName: row.inviter_name,
    alreadyMember: row.already_member,
  };
}

/** Joins the signed-in user to the invite's space; null when the link is not usable. */
export async function acceptInvite(db: Db, token: string): Promise<string | null> {
  const { data, error } = await db.rpc("accept_invite", { p_token: token });
  if (error) throw error;
  return data;
}

// ---- trash (phase 9) ------------------------------------------------------------------------

export { TRASH_DAYS } from "../../../supabase/functions/_shared/trash";

export interface TrashedNote {
  id: string;
  title: string;
  kind: NoteKind;
  color: string;
  previewText: string;
  deletedAt: string;
}

/** Scraps in a space's trash, most recently deleted first. RLS limits it to members. */
export async function listTrash(db: Db, spaceId: string): Promise<TrashedNote[]> {
  const { data, error } = await db
    .from("notes")
    .select("id, title, kind, color, preview_text, deleted_at")
    .eq("space_id", spaceId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind as NoteKind,
    color: row.color,
    previewText: row.preview_text,
    deletedAt: row.deleted_at as string,
  }));
}
