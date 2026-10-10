"use client";

import { Button } from "@scraps/ui";
import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/copy/useT";
import { joinSpace, type JoinState } from "./actions";

const idle: JoinState = { status: "idle" };

export function JoinForm({ token, alreadyMember }: { token: string; alreadyMember: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState(joinSpace, idle);

  return (
    <form action={action} className="invite__form">
      <input type="hidden" name="token" value={token} />
      {alreadyMember && <p className="field-hint">{t("invite.already")}</p>}
      {state.status === "error" && (
        <p role="alert" className="field-error">
          {t("invite.error")}
        </p>
      )}
      <div className="space-form__actions">
        <Link href="/invite/clear" className="sc-btn sc-btn--ghost">
          {t("invite.later")}
        </Link>
        <Button type="submit" color="yellow" disabled={pending}>
          {alreadyMember ? t("invite.open") : t("invite.join")}
        </Button>
      </div>
    </form>
  );
}
