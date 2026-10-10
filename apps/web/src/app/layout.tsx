import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/theme/ThemeProvider";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  parseThemePreference,
  resolveOnServer,
} from "@/theme/theme";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  variable: "--ff-display-loaded",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "600"],
  variable: "--ff-mono-loaded",
});

export const metadata: Metadata = {
  title: "scraps.",
  description: "your brain, but organised-ish.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The cookie lets the server render the right theme with no flash. `auto` is
  // corrected before first paint by the inline script below.
  const store = await cookies();
  const preference = parseThemePreference(store.get(THEME_COOKIE)?.value);

  return (
    <html
      lang="en"
      data-theme={resolveOnServer(preference)}
      data-theme-pref={preference}
      className={`${display.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider initialTheme={preference}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
