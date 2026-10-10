/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  RangeRequestsPlugin,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";
import { SHARE_TARGET_PATH, handleShareRequest } from "@/lib/share/handler";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Bump to refresh the precached offline page. */
const OFFLINE_REVISION = "1";

/** Signed urls carry a token that changes every hour: cache media under its path alone. */
const mediaKey = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    return `${url.origin}${url.pathname}`;
  },
};

/**
 * `/?capture=<share id>` is the board with a one-off id on it. Cache and look it up as the plain
 * board, otherwise a share opened offline would find no cached page and show the offline page.
 */
const pageKey = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    url.searchParams.delete("capture");
    return url.toString();
  },
};

const NOT_PAGES = ["/api/", "/auth/", "/sign-in", "/invite/", "/serwist/", SHARE_TARGET_PATH];

const runtimeCaching: RuntimeCaching[] = [
  // pictures and recordings by storage path (SPEC 10)
  {
    matcher: ({ url }) => url.pathname.includes("/storage/v1/object/sign/media/"),
    handler: new CacheFirst({
      cacheName: "media",
      plugins: [
        mediaKey,
        new RangeRequestsPlugin(),
        new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 }),
      ],
    }),
  },
  // link thumbnails through our own proxy are immutable per url
  {
    matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname === "/api/img",
    handler: new StaleWhileRevalidate({
      cacheName: "link-images",
      plugins: [new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 14 * 24 * 60 * 60 })],
    }),
  },
  // pages: the network when it answers quickly, the last copy otherwise
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin &&
      request.mode === "navigate" &&
      !NOT_PAGES.some((prefix) => url.pathname.startsWith(prefix)),
    handler: new NetworkFirst({
      cacheName: "pages",
      networkTimeoutSeconds: 3,
      plugins: [
        pageKey,
        new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 14 * 24 * 60 * 60 }),
      ],
    }),
  },
  // Next's own data requests for client navigations
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin &&
      request.headers.get("RSC") === "1" &&
      !NOT_PAGES.some((prefix) => url.pathname.startsWith(prefix)),
    handler: new NetworkFirst({
      cacheName: "pages-rsc",
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 14 * 24 * 60 * 60 })],
    }),
  },
  // Data from other origins (Supabase REST, auth, functions, realtime, the collab server) is never
  // served from a cache: a stale answer would overwrite what the app already knows locally. The
  // app's own persisted query cache is what carries data offline.
  {
    matcher: ({ sameOrigin }) => !sameOrigin,
    handler: new NetworkOnly(),
  },
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries: [...(self.__SW_MANIFEST ?? []), { url: "/offline", revision: OFFLINE_REVISION }],
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

// The web share target (manifest share_target, SPEC 9.6). Registered before Serwist's own fetch
// listener so it answers first; it needs no network, which is what makes sharing work offline.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === "POST" &&
    url.origin === self.location.origin &&
    url.pathname === SHARE_TARGET_PATH
  ) {
    event.respondWith(handleShareRequest(event.request, self.location.origin));
  }
});

serwist.addEventListeners();
