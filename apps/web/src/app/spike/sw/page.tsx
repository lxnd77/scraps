import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SwSpike } from "./SwSpike";

export const metadata: Metadata = { title: "scraps. sw spike", robots: { index: false } };

// Phase 0 spike page: proves a Serwist service worker registers and controls the page
// in a production build. Removed or folded into the real PWA setup in Phase 6.
export default function SwSpikePage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <SwSpike />;
}
