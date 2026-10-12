import { notFound } from "next/navigation";
import { z } from "zod";
import { kindCounts, listNotesPage } from "@scraps/db";
import { BoardView } from "@/components/shell/BoardView";
import { loadShellData, requireViewer } from "@/lib/session";

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!z.uuid().safeParse(spaceId).success) notFound();
  const { supabase } = await requireViewer();
  // RLS returns nothing for a space you are not in, so the board loads alongside the shell
  // and the membership check below decides what is shown
  const [{ spaces }, initialPage, initialCounts] = await Promise.all([
    loadShellData(),
    listNotesPage(supabase, spaceId),
    kindCounts(supabase, spaceId),
  ]);
  // a space you are not in looks exactly like a space that does not exist
  if (!spaces.some((s) => s.id === spaceId)) notFound();
  return <BoardView spaceId={spaceId} initialPage={initialPage} initialCounts={initialCounts} />;
}
