import type { Metadata } from "next";
import { BoardView } from "@/components/shell/BoardView";
import { loadShellData } from "@/lib/session";

export const metadata: Metadata = { title: "scraps." };

export default async function HomePage() {
  const { profile, spaces } = await loadShellData();
  const spaceId = profile.default_capture_space ?? spaces[0]?.id;
  // onboarding always creates a space, so this only trips on a broken account
  if (!spaceId) return <p>no spaces yet.</p>;
  return <BoardView spaceId={spaceId} />;
}
