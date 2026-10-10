import type { MetadataRoute } from "next";

/**
 * Web app manifest (phase 6.1). Manifest colours must be literal values, so they mirror the
 * daylight tokens (`--bg`, `--c-yellow`); manifest.test.ts fails if tokens.css moves on.
 * share_target (Phase 7) posts to /share-target, which the service worker answers (see sw.ts).
 */
export const MANIFEST_COLORS = { background: "#ede7ff", theme: "#ffd60a" } as const;

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "scraps.",
    short_name: "scraps.",
    description: "your brain, but organised-ish.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: MANIFEST_COLORS.background,
    theme_color: MANIFEST_COLORS.theme,
    categories: ["productivity", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    share_target: {
      action: "/share-target",
      method: "POST",
      enctype: "multipart/form-data",
      params: {
        title: "title",
        text: "text",
        url: "url",
        files: [{ name: "files", accept: ["image/*", "audio/*"] }],
      },
    },
    shortcuts: [
      {
        name: "new scrap",
        short_name: "new scrap",
        url: "/?capture=new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
