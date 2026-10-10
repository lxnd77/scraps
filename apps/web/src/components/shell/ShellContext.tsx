"use client";

import type { MemberAvatar, SpaceSummary, Streak } from "@scraps/db";
import { createContext, useContext, type ReactNode } from "react";

export interface ShellValue {
  user: { id: string; email: string };
  profile: {
    displayName: string;
    avatarSticker: string;
    tidyMode: boolean;
    /** suggestions are on (profiles.ai_enabled); off until the person opts in */
    aiEnabled: boolean;
    /** the one-time opt-in prompt has been answered, either way */
    aiPrompted: boolean;
    defaultCaptureSpace: string | null;
  };
  spaces: SpaceSummary[];
  /** streak at page load; the sidebar keeps it fresh through a query */
  streak: Streak;
  members: Record<string, MemberAvatar[]>;
}

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({ value, children }: { value: ShellValue; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside the app shell");
  return ctx;
}
