import type { Database } from "@scraps/db";
import {
  contentToYdoc,
  extractPreview,
  initialContent,
  ydocToContent,
  type NotePreview,
  type StartBlock,
  type StartMedia,
  ydocFromState,
} from "@scraps/editor";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Y from "yjs";

/** Card colour by what the scrap starts with (SPEC 8.4); the user can change it afterwards. */
const DEFAULT_COLOR: Partial<Record<StartBlock, string>> = {
  list: "lime",
  quote: "pink",
  image: "surface",
  mood: "surface",
  link: "blue",
  voice: "lilac",
};

export type Role = "owner" | "editor" | "viewer";

export interface CreateNoteInput {
  id: string;
  spaceId: string;
  userId: string;
  start: StartBlock;
  title?: string;
  text?: string;
  items?: string[];
  media?: StartMedia;
  /** a client-built Yjs update that becomes the note's document as is */
  state?: Uint8Array;
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
  /** writes the Yjs document (and the streak day); never touches the `notes` row */
  saveDoc(noteId: string, document: Y.Doc, editedBy: string | null): Promise<void>;
  /** writes the card fields and the search row: one `notes` update, one realtime event */
  savePreview(noteId: string, preview: NotePreview, editedBy: string | null): Promise<void>;
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

  async saveDoc(noteId: string, document: Y.Doc, editedBy: string | null): Promise<void> {
    const state = Y.encodeStateAsUpdate(document);
    const { error } = await this.db.rpc("store_note_doc", {
      p_note: noteId,
      p_ydoc: Buffer.from(state).toString("hex"),
      p_edited_by: editedBy as string,
    });
    if (error) throw error;
  }

  async savePreview(noteId: string, preview: NotePreview, editedBy: string | null): Promise<void> {
    const { error } = await this.db.rpc("store_note_preview", {
      p_note: noteId,
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
        {
          id: input.id,
          space_id: input.spaceId,
          created_by: input.userId,
          // card colour defaults by kind (SPEC 8.4); the user can change it afterwards
          color: DEFAULT_COLOR[input.start] ?? "yellow",
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;

    if (inserted && inserted.length > 0) {
      if (input.state) {
        await this.saveBoth(input.id, ydocFromState(input.state), input.userId);
        return { created: true, spaceId: input.spaceId };
      }
      const content = initialContent(input.start, {
        title: input.title,
        text: input.text,
        items: input.items,
        media: input.media,
      });
      await this.saveBoth(input.id, contentToYdoc(content), input.userId);
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

  /** A new note shows on the board at once: its card is written with its document. */
  private async saveBoth(noteId: string, document: Y.Doc, editedBy: string): Promise<void> {
    await this.saveDoc(noteId, document, editedBy);
    await this.savePreview(noteId, extractPreview(ydocToContent(document)), editedBy);
  }
}
