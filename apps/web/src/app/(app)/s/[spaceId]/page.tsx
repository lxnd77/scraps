import { notFound } from "next/navigation";
import { z } from "zod";
import { BoardView } from "@/components/shell/BoardView";
import { loadShellData } from "@/lib/session";

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const { spaces } = await loadShellData();
  // a space you are not in looks exactly like a space that does not exist
  if (!z.uuid().safeParse(spaceId).success || !spaces.some((s) => s.id === spaceId)) notFound();
  return <BoardView spaceId={spaceId} />;
}
