import { createSerwistRoute } from "@serwist/turbopack";

// Spike (Phase 0, task 0.9a). Serves /serwist/sw.js, built from src/app/sw.ts with esbuild,
// so Turbopack stays the bundler for both dev and production. Phase 6 grows this into the real SW.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute(
  {
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  },
);
