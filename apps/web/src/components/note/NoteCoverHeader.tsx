"use client";

import {
  ACCENTS,
  Button,
  Dialog,
  STICKER_IDS,
  Sticker,
  type Accent,
  type StickerId,
} from "@scraps/ui";
import type { MediaApi } from "@scraps/editor/react";
import type { CoverAccent, NoteCover } from "@scraps/db";
import { ImagePlus, Moon, SmilePlus, Trash2 } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { useT } from "@/copy/useT";

interface Props {
  cover: NoteCover | null;
  iconSticker: string | null;
  accent: CoverAccent;
  editable: boolean;
  media: MediaApi;
  onCover: (cover: NoteCover | null) => void;
  onIcon: (sticker: string | null) => void;
}

function Illustration() {
  // a moonlit scene in tokens only: sky, moon, hills
  return (
    <svg
      viewBox="0 0 800 210"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="cover__art"
    >
      <rect width="800" height="210" fill="var(--c-lilac)" />
      <circle cx="640" cy="64" r="34" fill="var(--c-yellow)" stroke="var(--line)" strokeWidth="3" />
      <path
        d="M0 160 Q150 90 300 150 T600 140 T800 150 V210 H0Z"
        fill="var(--c-blue)"
        stroke="var(--line)"
        strokeWidth="3"
      />
      <path
        d="M0 190 Q200 140 420 185 T800 180 V210 H0Z"
        fill="var(--c-pink)"
        stroke="var(--line)"
        strokeWidth="3"
      />
      <circle cx="120" cy="40" r="3" fill="var(--c-yellow)" />
      <circle cx="260" cy="70" r="2" fill="var(--c-yellow)" />
      <circle cx="430" cy="30" r="3" fill="var(--c-yellow)" />
    </svg>
  );
}

function Stripes({ a, b }: { a: string; b: string }) {
  const id = `stripes-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  // two accents in hard-edged bands, drawn as an SVG pattern (no gradients in this design)
  return (
    <svg className="cover__stripes" width="100%" height="100%" aria-hidden="true">
      <defs>
        <pattern
          id={id}
          width="56"
          height="56"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="28" height="56" fill={a} />
          <rect x="28" width="28" height="56" fill={b} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function CoverBody({
  cover,
  accent,
  media,
}: {
  cover: NoteCover;
  accent: CoverAccent;
  media: MediaApi;
}) {
  const url = media.useSignedUrl(cover.type === "image" ? cover.path : null);
  if (cover.type === "illustration") return <Illustration />;
  if (cover.type === "image") {
    return (
      <div className="cover__image" style={{ backgroundColor: cover.color ?? "var(--surface-2)" }}>
        {url && (
          // the cover is decorative; the title carries the meaning
          <img src={url} alt="" />
        )}
      </div>
    );
  }
  return <Stripes a={`var(--c-${cover.a})`} b={`var(--c-${cover.b ?? accent})`} />;
}

/** Cover band, page icon tile and their pickers (SPEC 6.3). */
export function NoteCoverHeader({
  cover,
  iconSticker,
  accent,
  editable,
  media,
  onCover,
  onIcon,
}: Props) {
  const t = useT();
  const [coverOpen, setCoverOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [a, setA] = useState<Accent>(accent);
  const [b, setB] = useState<Accent>("pink");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      const up = await media.uploadImage(chosen);
      onCover({ type: "image", path: up.path, color: up.color });
      setCoverOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("cover.error"));
    } finally {
      setBusy(false);
    }
  }

  if (!cover && !iconSticker && !editable) return null;

  return (
    <header className="cover">
      {cover ? (
        <div className="cover__band" data-type={cover.type}>
          <CoverBody cover={cover} accent={accent} media={media} />
          {editable && (
            <button type="button" className="cover__change" onClick={() => setCoverOpen(true)}>
              {t("cover.change")}
            </button>
          )}
        </div>
      ) : null}

      {/* what is missing is offered as a quiet pill; the icon tile shows once there is an icon */}
      {editable && (!cover || !iconSticker) && (
        <div className="cover__adds">
          {!cover && (
            <button type="button" className="cover__add" onClick={() => setCoverOpen(true)}>
              <ImagePlus size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("cover.add")}
            </button>
          )}
          {!iconSticker && (
            <button type="button" className="cover__add" onClick={() => setIconOpen(true)}>
              <SmilePlus size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("icon.add")}
            </button>
          )}
        </div>
      )}

      {iconSticker && (
        <button
          type="button"
          className="cover__icon"
          data-overlap={Boolean(cover)}
          disabled={!editable}
          aria-label={t("icon.change")}
          onClick={() => setIconOpen(true)}
        >
          <Sticker id={iconSticker as StickerId} size={64} />
        </button>
      )}

      <Dialog open={coverOpen} onClose={() => setCoverOpen(false)} title={t("cover.change")}>
        <div className="cover-picker">
          <fieldset className="picker">
            <legend className="field-label">{t("cover.pattern")}</legend>
            <div className="picker__row" role="group" aria-label={t("cover.first")}>
              {ACCENTS.map((c) => (
                <label key={c} className="picker__option">
                  <input
                    type="radio"
                    name="cover-a"
                    className="picker__input"
                    checked={a === c}
                    onChange={() => setA(c)}
                  />
                  <span className={`picker__swatch sc-fill-${c}`} />
                  <span className="sr-only">{c}</span>
                </label>
              ))}
            </div>
            <div className="picker__row" role="group" aria-label={t("cover.second")}>
              {ACCENTS.map((c) => (
                <label key={c} className="picker__option">
                  <input
                    type="radio"
                    name="cover-b"
                    className="picker__input"
                    checked={b === c}
                    onChange={() => setB(c)}
                  />
                  <span className={`picker__swatch sc-fill-${c}`} />
                  <span className="sr-only">{c}</span>
                </label>
              ))}
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                onCover({ type: "pattern", a, b });
                setCoverOpen(false);
              }}
            >
              {t("cover.use_pattern")}
            </Button>
          </fieldset>

          <Button
            variant="ghost"
            onClick={() => {
              onCover({ type: "illustration" });
              setCoverOpen(false);
            }}
          >
            <Moon size={18} strokeWidth={2.6} aria-hidden="true" />
            {t("cover.illustration")}
          </Button>

          <Button variant="ghost" disabled={busy} onClick={() => file.current?.click()}>
            <ImagePlus size={18} strokeWidth={2.6} aria-hidden="true" />
            {busy ? t("capture.saving") : t("cover.upload")}
          </Button>
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            hidden
            aria-label={t("cover.upload")}
            onChange={(e) => void upload(e)}
          />

          {cover && (
            <Button
              variant="ghost"
              onClick={() => {
                onCover(null);
                setCoverOpen(false);
              }}
            >
              <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("cover.remove")}
            </Button>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
      </Dialog>

      <Dialog open={iconOpen} onClose={() => setIconOpen(false)} title={t("icon.change")}>
        <div className="icon-picker">
          <ul className="icon-picker__grid">
            {STICKER_IDS.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="icon-picker__btn"
                  aria-label={id}
                  aria-pressed={iconSticker === id}
                  onClick={() => {
                    onIcon(id);
                    setIconOpen(false);
                  }}
                >
                  <Sticker id={id} size={44} />
                </button>
              </li>
            ))}
          </ul>
          {iconSticker && (
            <Button
              variant="ghost"
              onClick={() => {
                onIcon(null);
                setIconOpen(false);
              }}
            >
              {t("icon.remove")}
            </Button>
          )}
        </div>
      </Dialog>
    </header>
  );
}
