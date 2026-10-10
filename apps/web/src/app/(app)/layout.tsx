import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { loadShellData } from "@/lib/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, spaces, streak, members } = await loadShellData();
  return (
    <AppShell
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
      {children}
    </AppShell>
  );
}
