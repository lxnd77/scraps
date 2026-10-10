"use client";

import type { ReactNode } from "react";
import { saveTheme } from "@/lib/actions/theme";
import { ThemeProvider } from "./ThemeProvider";
import type { ThemePreference } from "./theme";

/** Theme provider wired to the profile: every toggle also writes profiles.theme. */
export function AppThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: ThemePreference;
  children: ReactNode;
}) {
  return (
    <ThemeProvider
      initialTheme={initialTheme}
      onThemeChange={(next) => {
        void saveTheme(next);
      }}
    >
      {children}
    </ThemeProvider>
  );
}
