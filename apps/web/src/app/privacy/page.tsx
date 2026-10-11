import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "scraps. privacy" };

/**
 * Privacy page (SPEC 12). Plain, lowercase and specific about vendors. Keep it in step with what
 * the code does: if a vendor or a data type changes, this page changes in the same commit.
 * Pending legal review before launch (DECISIONS).
 */
export default function PrivacyPage() {
  return (
    <main className="auth-page legal">
      <article className="legal__body">
        <h1>privacy</h1>
        <p className="sc-mono">last updated 11 october 2026 · draft until a lawyer has read it</p>

        <h2>the short version</h2>
        <p>
          scraps. keeps what you put in it so you can get it back, and nothing more. we don&apos;t
          sell your data, we don&apos;t run ads and we don&apos;t track you across the web.
        </p>

        <h2>what we keep</h2>
        <ul>
          <li>your email, your display name and the year you were born (to check you&apos;re 16 or over).</li>
          <li>
            your scraps: text, checklists, links, pictures, voice memos, tags and the spaces they
            live in, plus who else is in a space you share.
          </li>
          <li>
            small technical facts that make the app work: the days you were active (for the
            streak), your theme and settings, and capture tokens you create.
          </li>
        </ul>

        <h2>who helps us run it</h2>
        <ul>
          <li>
            <strong>supabase</strong> stores your account, scraps and files and sends your sign-in
            emails.
          </li>
          <li>
            <strong>groq</strong> turns voice memos into text. the audio of a memo is sent to groq
            when you record one. nothing else is.
          </li>
          <li>
            <strong>anthropic (claude)</strong> suggests where a scrap could go, only if you turn
            suggestions on in settings. it receives the scrap&apos;s text, its link title and the
            names of your spaces and tags. never pictures or voice memos.
          </li>
          <li>
            <strong>sentry</strong> receives error reports so we can fix bugs. we strip scrap
            content, titles and tokens from them before they leave.
          </li>
          <li>
            <strong>vercel and railway</strong> host the app and the live editing server.
          </li>
        </ul>

        <h2>how long we keep it</h2>
        <p>
          deleted scraps sit in the trash for 30 days, then they&apos;re removed with their files.
          if you delete your account everything you own is removed straight away, and it leaves our
          backups within 30 days.
        </p>

        <h2>your choices</h2>
        <ul>
          <li>export everything as a zip from settings, any time.</li>
          <li>delete your account from settings, any time.</li>
          <li>turn suggestions off from settings. they&apos;re off until you turn them on.</li>
        </ul>

        <p>
          <Link href="/terms">terms</Link> · <Link href="/sign-in">back to sign in</Link>
        </p>
      </article>
    </main>
  );
}
