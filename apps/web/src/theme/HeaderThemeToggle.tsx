"use client";

import { ThemeToggle } from "@scraps/ui";
import { useTheme } from "./ThemeProvider";

/** The header toggle wired to the theme provider. Tapping sets an explicit day or midnight. */
export function HeaderThemeToggle({ size = "lg" }: { size?: "lg" | "md" }) {
  const { resolved, setTheme } = useTheme();
  return <ThemeToggle size={size} isMidnight={resolved === "midnight"} onToggle={setTheme} />;
}
