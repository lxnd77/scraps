import { getNote, listSpaceTags } from "@scraps/db";
import { notFound } from "next/navigation";
import { z } from "zod";
import { NoteView } from "@/components/note/NoteView";
import { loadShellData, requireUser } from "@/lib/session";

export default async function NotePage({ params }: { params: Promise<{ noteId: string }> }) {
  const { noteId } = await params;
  if (!z.uuid().safeParse(noteId).success) notFound();

  const { spaces, user, profile } = await loadShellData();
  const { supabase } = await requireUser();

  // RLS hides notes you are not a member of, so "not yours" and "not there" look the same
  const note = await getNote(supabase, noteId);
  if (!note) notFound();
  const space = spaces.find((s) => s.id === note.spaceId);
  if (!space) notFound();

  const spaceTags = await listSpaceTags(supabase, note.spaceId);
  return (
    <NoteView
      note={note}
      space={{ id: space.id, name: space.name, color: space.color, role: space.role }}
      spaceTags={spaceTags}
      viewer={{ id: user.id, name: profile.display_name }}
    />
  );
}
