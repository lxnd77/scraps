import type { ReactNode } from "react";
import { loadShellData } from "@/lib/session";

/**
 * The editor is full page (SPEC 5): no sidebar and no tab bar. It still needs a signed-in,
 * onboarded user, which loadShellData enforces.
 */
export default async function NoteLayout({ children }: { children: ReactNode }) {
  await loadShellData();
  return <>{children}</>;
}
