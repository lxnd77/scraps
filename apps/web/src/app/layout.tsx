import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { KeyboardInset } from "@/components/KeyboardInset";
import { Monitoring } from "@/components/Monitoring";
import { ServiceWorker } from "@/components/ServiceWorker";
import { AppThemeProvider } from "@/theme/AppThemeProvider";
import {
  THEME_COOKIE,
  THEME_INIT_SCRIPT,
  parseThemePreference,
  resolveOnServer,
} from "@/theme/theme";
import "./globals.css";

// Self-hosted (latin subsets of the Google Fonts variable files, OFL 1.1, licences beside them):
// next/font/google fetches at compile time and silently falls back to Arial when that fetch
// fails, which a flaky connection on `pnpm dev` turned into a missing brand font.
const display = localFont({
  src: "./fonts/bricolage-grotesque-latin.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--ff-display-loaded",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  weight: "400 600",
  display: "swap",
  variable: "--ff-mono-loaded",
});

// Absolute URLs for the share card. Set NEXT_PUBLIC_SITE_URL on the custom domain; Vercel
// provides the production host otherwise.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "scraps.",
  description: "your brain, but organised-ish.",
  applicationName: "scraps.",
  // link previews can only show one card, so daylight leads and after midnight follows
  openGraph: {
    type: "website",
    siteName: "scraps.",
    title: "scraps.",
    description: "your brain, but organised-ish.",
    images: [
      {
        url: "/og/scraps-day.png",
        width: 1200,
        height: 630,
        alt: "scraps. on a board of loud cards",
      },
      { url: "/og/scraps-midnight.png", width: 1200, height: 630, alt: "scraps. after midnight" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "scraps.",
    description: "your brain, but organised-ish.",
    images: ["/og/scraps-day.png"],
  },
  appleWebApp: { capable: true, title: "scraps.", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // safe-area insets are 0 without cover; Android Chrome resizes the page for the keyboard
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffd60a" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0820" },
  ],
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
        <Monitoring />
        <KeyboardInset />
        <ServiceWorker>
          <AppThemeProvider initialTheme={preference}>{children}</AppThemeProvider>
        </ServiceWorker>
      </body>
    </html>
  );
}
