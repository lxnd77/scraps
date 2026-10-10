import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StyleguideView } from "./StyleguideView";

export const metadata: Metadata = {
  title: "scraps. styleguide",
  robots: { index: false, follow: false },
};

// Dev and preview builds only. Production deploys on Vercel return 404.
export default function StyleguidePage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <StyleguideView />;
}
