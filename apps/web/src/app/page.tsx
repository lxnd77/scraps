import Link from "next/link";
import { BrandMark } from "@scraps/ui";

// Placeholder until Phase 1 builds the app shell and sign-in.
export default function Home() {
  return (
    <main style={{ padding: "48px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BrandMark />
        <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.05em" }}>scraps.</span>
      </div>
      <p>your brain, but organised-ish.</p>
      <p>
        <Link href="/styleguide">open the styleguide</Link>
      </p>
    </main>
  );
}
