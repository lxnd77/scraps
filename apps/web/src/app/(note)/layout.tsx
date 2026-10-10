import type { ReactNode } from "react";
import { AiProvider } from "@/components/ai/AiProvider";
import { QueryProvider } from "@/components/shell/QueryProvider";
import { ShellProvider } from "@/components/shell/ShellContext";
import { loadShellData } from "@/lib/session";

/**
 * The editor is full page (SPEC 5): no sidebar and no tab bar. It still needs a signed-in,
 * onboarded user, which loadShellData enforces, and the same shell context and query client the
 * rest of the app uses (the share dialog and member lists read from them).
 */
export default async function NoteLayout({ children }: { children: ReactNode }) {
  const { user, profile, spaces, streak, members } = await loadShellData();
  return (
    <ShellProvider
      value={{
        user,
        profile: {
          displayName: profile.display_name,
          avatarSticker: profile.avatar_sticker,
          tidyMode: profile.tidy_mode,
          aiEnabled: profile.ai_enabled,
          aiPrompted: profile.ai_prompted_at !== null,
          defaultCaptureSpace: profile.default_capture_space,
        },
        spaces,
        streak,
        members,
      }}
    >
      <QueryProvider>
        <AiProvider>{children}</AiProvider>
      </QueryProvider>
    </ShellProvider>
  );
}
