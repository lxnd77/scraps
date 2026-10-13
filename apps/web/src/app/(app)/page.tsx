import type { Metadata } from "next";
import { BOARD_PAGE_SIZE, kindCounts, listBoardNotes } from "@scraps/db";
import { BoardView } from "@/components/shell/BoardView";
import { loadShellData, requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "scraps." };

export default async function HomePage() {
  const { profile, spaces } = await loadShellData();
  const spaceId = profile.default_capture_space ?? spaces[0]?.id;
  // onboarding always creates a space, so this only trips on a broken account
  if (!spaceId) return <p>no spaces yet.</p>;
  const { supabase } = await requireViewer();
  const [initialNotes, initialCounts] = await Promise.all([
    listBoardNotes(supabase, spaceId),
    kindCounts(supabase, spaceId),
  ]);
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
