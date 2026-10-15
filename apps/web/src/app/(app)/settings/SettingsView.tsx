"use client";

import { Button, type StickerId } from "@scraps/ui";
import { THEME_PREFERENCES, type ThemePreferenceValue } from "@scraps/db";
import { useActionState, useState, useTransition } from "react";
import {
  setAiEnabled,
  setTidyMode,
  signOut,
  updateProfile,
  type FormState,
} from "@/app/(app)/actions";
import { StickerPicker } from "@/components/pickers";
import { useInstall } from "@/components/install/InstallProvider";
import { AboutDialog } from "@/components/shell/AboutDialog";
import { PageHeading } from "@/components/shell/PageHeading";
import { useShell } from "@/components/shell/ShellContext";
import type { CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import { useTheme } from "@/theme/ThemeProvider";
import { CaptureSection } from "./CaptureSection";
import { DeleteAccount } from "./DeleteAccount";
import { ExportData } from "./ExportData";
import { StorageMeter } from "./StorageMeter";
import type { CaptureTokenRow } from "./capture-actions";

const idle: FormState = { status: "idle" };

const THEME_LABEL: Record<ThemePreferenceValue, CopyKey> = {
  day: "settings.theme.day",
  midnight: "settings.theme.midnight",
  auto: "settings.theme.auto",
};

function ProfileSection() {
  const t = useT();
  const { profile } = useShell();
  const [state, action, pending] = useActionState(updateProfile, idle);
  const nameError = state.status === "error" ? state.fieldErrors?.displayName : undefined;

  return (
    <section className="panel" aria-labelledby="settings-profile">
      <h2 id="settings-profile" className="panel__title">
        {t("settings.profile")}
      </h2>
      <form action={action} className="space-form" noValidate>
        <div className="field">
          <label htmlFor="displayName" className="field-label">
            {t("settings.name")}
          </label>
          <input
            id="displayName"
            name="displayName"
            className="field-input"
            defaultValue={profile.displayName}
            maxLength={40}
            required
            autoComplete="nickname"
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? "displayName-error" : undefined}
          />
          {nameError && (
            <p id="displayName-error" role="alert" className="field-error">
              {nameError}
            </p>
          )}
        </div>
        <StickerPicker
          name="avatarSticker"
          legend={t("settings.sticker")}
          defaultValue={profile.avatarSticker as StickerId}
        />
        <div className="space-form__actions">
          {state.status === "ok" && (
            <p role="status" className="sc-mono">
              {t("settings.saved")}
            </p>
          )}
          <Button type="submit" color="yellow" disabled={pending}>
            {t("settings.save")}
          </Button>
        </div>
      </form>
    </section>
  );
}

function LookSection() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const { profile } = useShell();
  const [, startTransition] = useTransition();

  return (
    <section className="panel" aria-labelledby="settings-look">
      <h2 id="settings-look" className="panel__title">
        {t("settings.look")}
      </h2>

      <fieldset className="picker">
        <legend className="field-label">{t("settings.theme")}</legend>
        <div className="choice-row">
          {THEME_PREFERENCES.map((value) => (
            <label key={value} className="choice">
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => setTheme(value)}
                className="picker__input"
              />
              <span className="choice__label">{t(THEME_LABEL[value])}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="switch-row">
        <div>
          <p className="switch-row__title" id="tidy-title">
            {t("settings.tidy")}
          </p>
          <p className="switch-row__hint">{t("settings.tidy.hint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={profile.tidyMode}
          aria-labelledby="tidy-title"
          className="switch"
          onClick={() => startTransition(() => setTidyMode(!profile.tidyMode))}
        >
          <span className="switch__knob" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function AiSection() {
  const t = useT();
  const { profile } = useShell();
  const [, startTransition] = useTransition();

  return (
    <section className="panel" aria-labelledby="settings-ai">
      <h2 id="settings-ai" className="panel__title">
        {t("settings.ai")}
      </h2>
      <div className="switch-row">
        <div>
          <p className="switch-row__title" id="ai-title">
            {t("settings.ai.title")}
          </p>
          <p className="switch-row__hint">{t("settings.ai.hint")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={profile.aiEnabled}
          aria-labelledby="ai-title"
          className="switch"
          onClick={() => startTransition(() => setAiEnabled(!profile.aiEnabled))}
        >
          <span className="switch__knob" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function InstallSection() {
  const t = useT();
  const { available, installed, install } = useInstall();
  return (
    <section className="panel" aria-labelledby="settings-install">
      <h2 id="settings-install" className="panel__title">
        {t("settings.install")}
      </h2>
      {installed ? (
        <p className="field-hint">{t("settings.install.done")}</p>
      ) : available ? (
        <>
          <p className="field-hint">{t("settings.install.hint")}</p>
          <Button variant="ghost" onClick={install}>
            {t("settings.install.button")}
          </Button>
        </>
      ) : (
        <p className="field-hint">{t("settings.install.unavailable")}</p>
      )}
    </section>
  );
}

function DataSection() {
  const t = useT();
  return (
    <section className="panel" aria-labelledby="settings-data">
      <h2 id="settings-data" className="panel__title">
        {t("settings.data")}
      </h2>
      <StorageMeter />
      <ExportData />
    </section>
  );
}

function AccountSection() {
  const t = useT();
  const { user } = useShell();
  return (
    <section className="panel" aria-labelledby="settings-account">
      <h2 id="settings-account" className="panel__title">
        {t("settings.account")}
      </h2>
      <p className="sc-mono">{user.email}</p>
      <div className="space-form__actions">
        <form action={signOut}>
          <Button type="submit" variant="dark">
            {t("settings.signout")}
          </Button>
        </form>
        <DeleteAccount />
      </div>
    </section>
  );
}

/** On every screen (the sidebar's "?" is desktop only): what scraps is and who made it. */
function AboutSection() {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <section className="panel" aria-labelledby="settings-about">
      <h2 id="settings-about" className="panel__title">
        {t("about.open")}
      </h2>
      <p>{t("about.what")}</p>
      <div className="space-form__actions">
        <Button variant="ghost" onClick={() => setOpen(true)}>
          {t("about.more")}
        </Button>
      </div>
      <AboutDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

interface SettingsViewProps {
  captureTokens: CaptureTokenRow[];
  shortcutUrl: string | null;
  captureEndpoint: string;
}

export function SettingsView({ captureTokens, shortcutUrl, captureEndpoint }: SettingsViewProps) {
  const t = useT();
  return (
    <div className="page">
      <PageHeading title={t("settings.title")} />
      <div className="page__stack">
        <ProfileSection />
        <LookSection />
        <AiSection />
        <InstallSection />
        <CaptureSection
          initialTokens={captureTokens}
          shortcutUrl={shortcutUrl}
          captureEndpoint={captureEndpoint}
        />
        <DataSection />
        <AccountSection />
        <AboutSection />
      </div>
    </div>
  );
}
