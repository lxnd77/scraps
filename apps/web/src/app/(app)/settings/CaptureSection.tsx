"use client";

import { Button } from "@scraps/ui";
import { useState, useTransition } from "react";
import { useT } from "@/copy/useT";
import { relativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";
import { createCaptureToken, revokeCaptureToken, type CaptureTokenRow } from "./capture-actions";

interface Props {
  initialTokens: CaptureTokenRow[];
  /** hosted `.shortcut` link, from NEXT_PUBLIC_SHORTCUT_URL; null until the file is hosted */
  shortcutUrl: string | null;
  /** the capture Edge Function address the shortcut posts to */
  captureEndpoint: string;
}

type Problem = "invalid" | "limit" | "failed" | null;

/** Settings → capture (SPEC 6.7): tokens for the iOS shortcut and how to build it (phase 7). */
export function CaptureSection({ initialTokens, shortcutUrl, captureEndpoint }: Props) {
  const t = useT();
  const now = useNow();
  const [tokens, setTokens] = useState(initialTokens);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [problem, setProblem] = useState<Problem>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setProblem(null);
    startTransition(async () => {
      const result = await createCaptureToken(label);
      if (result.status === "error") {
        setProblem(result.reason);
        return;
      }
      setFresh(result.token);
      setCopied(false);
      setLabel("");
      setTokens((current) => [result.row, ...current]);
    });
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeCaptureToken(id);
      setConfirming(null);
      if (!result.ok) {
        setProblem("failed");
        return;
      }
      setProblem(null);
      setTokens((current) => current.filter((row) => row.id !== id));
    });
  }

  async function copy() {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh);
      setCopied(true);
    } catch {
      // clipboard blocked: the token is selectable in the box below
    }
  }

  return (
    <section className="panel" aria-labelledby="settings-capture">
      <h2 id="settings-capture" className="panel__title">
        {t("settings.capture")}
      </h2>
      <p className="field-hint">{t("settings.capture.hint")}</p>

      {fresh ? (
        <div className="token-fresh" role="status">
          <p className="field-label">{t("settings.capture.created")}</p>
          <code className="token-fresh__value sc-mono">{fresh}</code>
          <div className="token-fresh__actions">
            <Button type="button" color="yellow" onClick={() => void copy()}>
              {copied ? t("settings.capture.copied") : t("settings.capture.copy")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setFresh(null)}>
              {t("settings.capture.done")}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="token-form"
          onSubmit={(event) => {
            event.preventDefault();
            create();
          }}
        >
          <div className="field">
            <label htmlFor="capture-token-label" className="field-label">
              {t("settings.capture.label")}
            </label>
            <input
              id="capture-token-label"
              className="field-input"
              value={label}
              maxLength={40}
              placeholder={t("settings.capture.placeholder")}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <Button type="submit" color="yellow" disabled={pending}>
            {t("settings.capture.create")}
          </Button>
        </form>
      )}

      {problem && (
        <p role="alert" className="field-error">
          {problem === "limit" ? t("settings.capture.limit") : t("settings.capture.error")}
        </p>
      )}

      {tokens.length === 0 ? (
        <p className="field-hint">{t("settings.capture.empty")}</p>
      ) : (
        <ul className="token-list">
          {tokens.map((row) => {
            const name = row.label || t("settings.capture.unnamed");
            return (
              <li key={row.id} className="token-list__row">
                <div>
                  <p className="token-list__name">{name}</p>
                  <p className="sc-mono token-list__meta">
                    {row.lastUsedAt
                      ? t("settings.capture.used", {
                          when: now ? relativeTime(row.lastUsedAt, now) : "",
                        })
                      : t("settings.capture.never")}
                  </p>
                </div>
                {confirming === row.id ? (
                  <div className="token-list__confirm" role="group" aria-label={name}>
                    <span className="field-hint">
                      {t("settings.capture.revoke_confirm", { name })}
                    </span>
                    <Button
                      type="button"
                      variant="dark"
                      disabled={pending}
                      onClick={() => revoke(row.id)}
                    >
                      {t("settings.capture.revoke")}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setConfirming(null)}>
                      {t("settings.capture.done")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`${t("settings.capture.revoke")} ${name}`}
                    onClick={() => setConfirming(row.id)}
                  >
                    {t("settings.capture.revoke")}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h3 className="panel__subtitle">{t("settings.shortcut.title")}</h3>
      {shortcutUrl ? (
        <a className="sc-btn sc-btn--ghost" href={shortcutUrl}>
          {t("settings.shortcut.get")}
        </a>
      ) : (
        <p className="field-hint">{t("settings.shortcut.missing")}</p>
      )}
      <p className="field-label">{t("settings.shortcut.steps")}</p>
      <ol className="shortcut-steps">
        <li>{t("settings.shortcut.step1")}</li>
        <li>{t("settings.shortcut.step2")}</li>
        <li>
          {t("settings.shortcut.step3")}
          <code className="sc-mono shortcut-steps__code">{captureEndpoint}</code>
        </li>
        <li>{t("settings.shortcut.step4")}</li>
        <li>{t("settings.shortcut.step5")}</li>
        <li>{t("settings.shortcut.step6")}</li>
      </ol>
      <p className="field-hint">{t("settings.shortcut.lost")}</p>
    </section>
  );
}
