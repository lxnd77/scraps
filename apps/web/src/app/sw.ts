/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  RangeRequestsPlugin,
  Serwist,
  StaleWhileRevalidate,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

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

const NOT_PAGES = ["/api/", "/auth/", "/sign-in", "/invite/", "/serwist/"];

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
      plugins: [new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 14 * 24 * 60 * 60 })],
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

serwist.addEventListeners();
