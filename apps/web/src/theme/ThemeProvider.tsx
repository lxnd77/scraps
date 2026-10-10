"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  THEME_COOKIE,
  resolveOnServer,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme";

interface ThemeContextValue {
  /** what the user chose: day, midnight or auto */
  theme: ThemePreference;
  /** what is actually showing */
  resolved: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function writeCookie(preference: ThemePreference) {
  document.cookie = `${THEME_COOKIE}=${preference}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

export function ThemeProvider({
  initialTheme,
  onThemeChange,
  children,
}: {
  initialTheme: ThemePreference;
  /** Phase 1 persists the choice to profiles.theme here */
  onThemeChange?: (next: ThemePreference) => void;
  children: ReactNode;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(initialTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(resolveOnServer(initialTheme));
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Keep the resolved theme (and <html data-theme>) in step with the preference and the device.
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const apply = () => {
      const next = resolveTheme(theme, media.matches);
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.setAttribute("data-theme-pref", theme);
      setResolved(next);
    };
    apply();
    if (theme !== "auto") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const setTheme = useCallback(
    (next: ThemePreference) => {
      const root = document.documentElement;
      // cross-fade background and surfaces over --dur-slow, then drop the class
      root.classList.add("sc-theme-fading");
      clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => root.classList.remove("sc-theme-fading"), 450);
      writeCookie(next);
      setThemeState(next);
      onThemeChange?.(next);
    },
    [onThemeChange],
  );

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
