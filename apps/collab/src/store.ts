import type { Database } from "@scraps/db";
import {
  contentToYdoc,
  extractPreview,
  initialContent,
  ydocToContent,
  type StartBlock,
} from "@scraps/editor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Y from "yjs";

export type Role = "owner" | "editor" | "viewer";

export interface CreateNoteInput {
  id: string;
  spaceId: string;
  userId: string;
  start: StartBlock;
  title?: string;
  text?: string;
  items?: string[];
}

export interface CreateNoteResult {
  /** false when the id already existed (idempotent replay) */
  created: boolean;
  spaceId: string;
}

/** What the collab server needs from persistence. The Supabase one is below; tests use a fake. */
export interface NoteStore {
  noteRole(noteId: string, userId: string): Promise<Role | null>;
  spaceRole(spaceId: string, userId: string): Promise<Role | null>;
  /** the stored Yjs state, or null when the note has no document yet */
  load(noteId: string): Promise<Uint8Array | null>;
  /** writes the document and the derived card fields in one transaction */
  save(noteId: string, document: Y.Doc, editedBy: string | null): Promise<void>;
  createNote(input: CreateNoteInput): Promise<CreateNoteResult | { conflict: true }>;
}

function toRole(value: unknown): Role | null {
  return value === "owner" || value === "editor" || value === "viewer" ? value : null;
}

/** PostgREST returns bytea as `\x`-prefixed hex. */
function fromHex(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value.startsWith("\\x") ? value.slice(2) : value, "hex"));
}

export class SupabaseNoteStore implements NoteStore {
  private readonly db: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async noteRole(noteId: string, userId: string): Promise<Role | null> {
    const { data, error } = await this.db.rpc("note_access", { p_note: noteId, p_user: userId });
    if (error) throw error;
    return toRole(data);
  }

  async spaceRole(spaceId: string, userId: string): Promise<Role | null> {
    const { data, error } = await this.db.rpc("space_access", { p_space: spaceId, p_user: userId });
    if (error) throw error;
    return toRole(data);
  }

  async load(noteId: string): Promise<Uint8Array | null> {
    const { data, error } = await this.db
      .from("note_docs")
      .select("ydoc")
      .eq("note_id", noteId)
      .maybeSingle();
    if (error) throw error;
    return data?.ydoc ? fromHex(data.ydoc as string) : null;
  }

  async save(noteId: string, document: Y.Doc, editedBy: string | null): Promise<void> {
    const state = Y.encodeStateAsUpdate(document);
    const preview = extractPreview(ydocToContent(document));
    const { error } = await this.db.rpc("store_note", {
      p_note: noteId,
      p_ydoc: Buffer.from(state).toString("hex"),
      p_title: preview.title,
      p_preview_text: preview.previewText,
      p_kind: preview.kind,
      p_word_count: preview.wordCount,
      p_preview: preview.preview as never,
      p_search: preview.searchText,
      p_edited_by: editedBy as string,
    });
    if (error) throw error;
  }

  async createNote(input: CreateNoteInput): Promise<CreateNoteResult | { conflict: true }> {
    const { data: inserted, error } = await this.db
      .from("notes")
      .upsert(
        { id: input.id, space_id: input.spaceId, created_by: input.userId },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;

    if (inserted && inserted.length > 0) {
      const content = initialContent(input.start, { title: input.title, text: input.text, items: input.items });
      await this.save(input.id, contentToYdoc(content), input.userId);
      return { created: true, spaceId: input.spaceId };
    }

    // replay of an earlier create: fine if it is the same note, a conflict if the id is taken
    const { data: existing, error: lookupError } = await this.db
      .from("notes")
      .select("space_id, created_by")
      .eq("id", input.id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing || existing.space_id !== input.spaceId || existing.created_by !== input.userId) {
      return { conflict: true };
    }
    return { created: false, spaceId: existing.space_id };
  }
}
