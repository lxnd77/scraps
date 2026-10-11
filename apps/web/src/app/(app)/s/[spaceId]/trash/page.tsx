import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { listTrash } from "@scraps/db";
import { loadShellData, requireUser } from "@/lib/session";
import { TrashView } from "./TrashView";

export const metadata: Metadata = { title: "scraps. trash" };

export default async function TrashPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const { spaces } = await loadShellData();
  const space = z.uuid().safeParse(spaceId).success ? spaces.find((s) => s.id === spaceId) : null;
  // a space you are not in looks exactly like a space that does not exist
  if (!space) notFound();
  const { supabase } = await requireUser();
  const notes = await listTrash(supabase, spaceId);
  return (
    <TrashView space={{ id: space.id, name: space.name, role: space.role }} initialNotes={notes} />
  );
}
