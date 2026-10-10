import { uuidv7 } from "@scraps/db";
import { createNoteRemote, type CreateNoteRequest } from "@/lib/collab";
import { createClient } from "@/lib/supabase/client";

export interface NewNote extends Omit<CreateNoteRequest, "id"> {
  /** pass an id to make the call safe to repeat; one is generated otherwise */
  id?: string;
}

/**
 * The one client-side way to make a scrap: quick capture and the starter scraps both use it.
 * Phase 6 routes this through the outbox so it also works offline; the ids are already client
 * generated (v7) so a queued note keeps its id.
 */
export async function createNote(note: NewNote): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not signed in");
  const id = note.id ?? uuidv7();
  await createNoteRemote(token, { ...note, id });
  return id;
}

/** A fresh access token for calls straight to the collab server. */
export async function accessToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("not signed in");
  return token;
}
