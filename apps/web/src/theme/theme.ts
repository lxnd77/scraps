/** `auto` follows the device; `day` and `midnight` are explicit choices. */
export type ThemePreference = "day" | "midnight" | "auto";
export type ResolvedTheme = "day" | "midnight";

export const THEME_COOKIE = "scraps-theme";

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "day" || value === "midnight" || value === "auto";
}

export function parseThemePreference(value: string | undefined | null): ThemePreference {
  return isThemePreference(value) ? value : "auto";
}

/** What the server can resolve without a media query. `auto` stays day until the head script runs. */
export function resolveOnServer(preference: ThemePreference): ResolvedTheme {
  return preference === "midnight" ? "midnight" : "day";
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === "auto") return prefersDark ? "midnight" : "day";
  return preference;
}

/**
 * Runs in <head> before first paint: reads the cookie and the media query and
 * sets data-theme, so there is no flash of the wrong theme. Kept as a plain
 * string so it can be inlined with no bundler involved.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);var p=m?decodeURIComponent(m[1]):"auto";if(p!=="day"&&p!=="midnight")p="auto";var d=p==="midnight"||(p==="auto"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var h=document.documentElement;h.setAttribute("data-theme",d?"midnight":"day");h.setAttribute("data-theme-pref",p);}catch(e){}})();`;
