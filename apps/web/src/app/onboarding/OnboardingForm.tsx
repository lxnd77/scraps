"use client";

import { BrandMark, Button } from "@scraps/ui";
import { uuidv7 } from "@scraps/db";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StickerPicker } from "@/components/pickers";
import { useT } from "@/copy/useT";
import { createStarterScraps } from "@/lib/starters";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";
import { completeOnboarding, type OnboardingState } from "./actions";

const idle: OnboardingState = { status: "idle" };

const noSubscribe = () => () => {};
const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(completeOnboarding, idle);
  const router = useRouter();
  const startersStarted = useRef(false);
  const [starterIds] = useState(() => [uuidv7(), uuidv7(), uuidv7()]);

  // the account is saved: put the three starter scraps on the board, then go there
  useEffect(() => {
    if (state.status !== "done" || startersStarted.current) return;
    startersStarted.current = true;
    void createStarterScraps(state.spaceId, starterIds)
      .catch(() => {
        // the board works without them; skip rather than trap the user here
      })
      .finally(() => router.replace("/"));
  }, [state, router, starterIds]);
  // the browser knows the real timezone; the server would only guess UTC
  const timezone = useSyncExternalStore(noSubscribe, browserTimezone, () => "UTC");
  const busy = pending || state.status === "done";
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const formError = state.status === "error" && state.messageKey ? t(state.messageKey) : undefined;

  return (
    <main className="auth-page">
      <header className="auth-header">
        <div className="auth-header__top">
          <BrandMark size={56} />
          <HeaderThemeToggle size="md" />
        </div>
        <h1 className="auth-wordmark auth-wordmark--sm">{t("onboarding.title")}</h1>
      </header>

      <form action={action} className="auth-panel" noValidate>
        <input type="hidden" name="timezone" value={timezone} />

        <div className="field">
          <label htmlFor="displayName" className="field-label">
            {t("onboarding.name.label")}
          </label>
          <input
            id="displayName"
            name="displayName"
            className="field-input"
            defaultValue={defaultName}
            maxLength={40}
            required
            autoComplete="nickname"
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? "displayName-error" : undefined}
          />
          {errors.displayName && (
            <p id="displayName-error" role="alert" className="field-error">
              {errors.displayName}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="birthYear" className="field-label">
            {t("onboarding.birth.label")}
          </label>
          <input
            id="birthYear"
            name="birthYear"
            className="field-input"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            placeholder="2003"
            required
            aria-invalid={Boolean(errors.birthYear)}
            aria-describedby={errors.birthYear ? "birthYear-error" : "birthYear-hint"}
          />
          <p id="birthYear-hint" className="field-hint">
            {t("onboarding.birth.hint")}
          </p>
          {errors.birthYear && (
            <p id="birthYear-error" role="alert" className="field-error">
              {errors.birthYear}
            </p>
          )}
        </div>

        <StickerPicker
          name="avatarSticker"
          legend={t("onboarding.sticker.label")}
          defaultValue="smiley"
        />

        {formError && (
          <p role="alert" className="field-error">
            {formError}
          </p>
        )}

        <Button type="submit" color="yellow" disabled={busy} className="auth-submit">
          {t("onboarding.submit")}
        </Button>
      </form>
    </main>
  );
}
