import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "scraps. terms" };

/** Placeholder terms. Replace with counsel-approved text before launch (Phase 9.11). */
export default function TermsPage() {
  return (
    <main className="auth-page legal">
      <article className="legal__body">
        <h1>terms</h1>
        <p className="sc-mono">placeholder · not final</p>
        <p>
          these are the plain-language terms while the app is in early access. a lawyer-approved
          version replaces this page before launch.
        </p>
        <ul>
          <li>you need to be 16 or over.</li>
          <li>what you write is yours. you let us store it so the app can work.</li>
          <li>don&apos;t use scraps. to harm people or break the law.</li>
          <li>the app is provided as is while we build it. keep an export of anything precious.</li>
        </ul>
        <p>
          <Link href="/privacy">privacy</Link> · <Link href="/sign-in">back to sign in</Link>
        </p>
      </article>
    </main>
  );
}
