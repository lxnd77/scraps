import type { Metadata } from "next";
import { previewInvite } from "@scraps/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfile } from "@scraps/db";
import { createClient } from "@/lib/supabase/server";
import { isInviteToken } from "@/lib/invite-cookie";
import { t } from "@/copy/en";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "scraps. invite" };
// the page depends on who is looking
export const dynamic = "force-dynamic";

function Broken() {
  return (
    <main className="auth-page">
      <section className="notfound">
        <h1 className="notfound__title">{t("invite.broken.title")}</h1>
        <p className="field-hint">{t("invite.broken.body")}</p>
        <Link href="/invite/clear" className="sc-btn sc-btn--dark">
          {t("error.back_to_board")}
        </Link>
      </section>
    </main>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isInviteToken(token)) return <Broken />;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/invite/${token}/start`);

  // new people finish onboarding first; the invite waits in a cookie and brings them back
  const profile = await getProfile(supabase, data.user.id);
  if (!profile?.onboarded_at) {
    redirect(`/invite/${token}/start`);
  }

  const preview = await previewInvite(supabase, token);
  if (!preview) return <Broken />;

  return (
    <main className="auth-page">
      <section className="auth-panel invite">
        <p className="sc-label">{t("invite.kicker", { name: preview.inviterName })}</p>
        <h1 className="invite__title">{t("invite.title", { space: preview.spaceName })}</h1>
        <p className="field-hint">
          {preview.role === "editor" ? t("invite.role.editor") : t("invite.role.viewer")}
        </p>
        <JoinForm token={token} alreadyMember={preview.alreadyMember} />
      </section>
    </main>
  );
}
