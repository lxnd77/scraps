import { notFound } from "next/navigation";
import { z } from "zod";
import { BOARD_PAGE_SIZE, kindCounts, listBoardNotes } from "@scraps/db";
import { BoardView } from "@/components/shell/BoardView";
import { loadShellData, requireViewer } from "@/lib/session";

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  if (!z.uuid().safeParse(spaceId).success) notFound();
  const { supabase } = await requireViewer();
  // RLS returns nothing for a space you are not in, so the board loads alongside the shell
  // and the membership check below decides what is shown
  const [{ spaces }, initialNotes, initialCounts] = await Promise.all([
    loadShellData(),
    listBoardNotes(supabase, spaceId),
    kindCounts(supabase, spaceId),
  ]);
  // a space you are not in looks exactly like a space that does not exist
  if (!spaces.some((s) => s.id === spaceId)) notFound();
  // the canvas wants every card; the list layout's first page is the head of the same rows
  const initialPage = {
    notes: initialNotes.slice(0, BOARD_PAGE_SIZE),
    nextPage: initialNotes.length > BOARD_PAGE_SIZE ? 1 : null,
  };
  return (
    <BoardView
      spaceId={spaceId}
      initialNotes={initialNotes}
      initialPage={initialPage}
      initialCounts={initialCounts}
    />
  );
}
