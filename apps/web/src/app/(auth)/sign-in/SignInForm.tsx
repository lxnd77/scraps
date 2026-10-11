"use client";

import { Button } from "@scraps/ui";
import Link from "next/link";
import { useActionState } from "react";
import { useT } from "@/copy/useT";
import { requestMagicLink, signInWithGoogle, type SignInState } from "./actions";

const idle: SignInState = { status: "idle" };

export function SignInForm({ notice }: { notice: "link" | "underage" | null }) {
  const t = useT();
  const [state, sendLink, sending] = useActionState(requestMagicLink, idle);
  const [googleState, google, googling] = useActionState(signInWithGoogle, idle);

  if (state.status === "sent") {
    return (
      <div className="auth-panel" role="status">
        <h2 className="auth-panel__title">{t("auth.sent.title")}</h2>
        <p>{t("auth.sent.body", { email: state.email })}</p>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          {t("auth.sent.again")}
        </Button>
      </div>
    );
  }

  const error =
    state.status === "error" ? state : googleState.status === "error" ? googleState : null;
  const message = error
    ? t(error.messageKey)
    : notice === "link"
      ? t("auth.error.link")
      : notice === "underage"
        ? t("onboarding.underage")
        : null;

  return (
    <div className="auth-panel">
      <form action={sendLink} className="auth-form" noValidate>
        <label htmlFor="email" className="auth-label">
          {t("auth.email.label")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder={t("auth.email.placeholder")}
          className="auth-input"
          aria-invalid={state.status === "error" && Boolean(state.fieldError)}
          aria-describedby={
            message || (state.status === "error" && state.fieldError) ? "auth-error" : undefined
          }
        />
        {state.status === "error" && state.fieldError && (
          <p id="auth-error" role="alert" className="auth-error">
            {state.fieldError}
          </p>
        )}
        <Button type="submit" color="yellow" disabled={sending} className="auth-submit">
          {sending ? t("auth.sending") : t("auth.send")}
        </Button>
      </form>

      <p className="auth-divider" aria-hidden="true">
        {t("auth.divider")}
      </p>

      <form action={google}>
        <Button type="submit" variant="ghost" disabled={googling} className="auth-submit">
          {t("auth.google")}
        </Button>
      </form>

      {message && !(state.status === "error" && state.fieldError) && (
        <p id="auth-error" role="alert" className="auth-error">
          {message}
        </p>
      )}

      <p className="auth-legal sc-mono">
        {t("auth.legal.lead")} <Link href="/terms">{t("auth.legal.terms")}</Link>{" "}
        {t("auth.legal.and")} <Link href="/privacy">{t("auth.legal.privacy")}</Link>
      </p>
    </div>
  );
}
