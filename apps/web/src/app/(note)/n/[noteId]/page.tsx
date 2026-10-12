import { getNote, listSpaceTags } from "@scraps/db";
import { notFound } from "next/navigation";
import { z } from "zod";
import { NoteView } from "@/components/note/NoteView";
import { loadShellData, requireViewer } from "@/lib/session";

export default async function NotePage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  if (!z.uuid().safeParse(noteId).success) notFound();

  const { supabase } = await requireViewer();
  // the note does not depend on the shell data, so both load at once
  const [{ spaces, user, profile }, note] = await Promise.all([
    loadShellData(),
    getNote(supabase, noteId),
  ]);

  // RLS hides notes you are not a member of, so "not yours" and "not there" look the same
  if (!note) notFound();
  const space = spaces.find((s) => s.id === note.spaceId);
  if (!space) notFound();

  const spaceTags = await listSpaceTags(supabase, note.spaceId);
  return (
    <NoteView
      note={note}
      space={{ id: space.id, name: space.name, color: space.color, role: space.role }}
      spaceTags={spaceTags}
      viewer={{ id: user.id, name: profile.display_name, sticker: profile.avatar_sticker }}
    />
  );
}
