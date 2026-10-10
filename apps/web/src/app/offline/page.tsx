import type { Metadata } from "next";

export const metadata: Metadata = { title: "scraps. offline" };

/** Precached by the service worker; shown when a page is not available without a connection. */
export default function OfflinePage() {
  return (
    <main className="auth-page">
      <section className="notfound">
        <h1 className="notfound__title">you're offline</h1>
        <p className="field-hint">
          this page isn't saved on this device yet. what you've already opened still works.
        </p>
        <a href="/" className="sc-btn sc-btn--dark">
          back to your board
        </a>
      </section>
    </main>
  );
}
