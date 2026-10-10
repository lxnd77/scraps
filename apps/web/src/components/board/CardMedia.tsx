"use client";

import type { NoteSummary } from "@scraps/db";
import { Waveform } from "@scraps/ui";
import { Link2, MapPin, Pause, Play } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/copy/useT";
import { formatClock } from "@/lib/media/audio";
import { useSignedUrl } from "@/lib/media/signedUrl";

/** First picture of a pic card, with the loading box held by an aspect ratio. */
export function PicMedia({ note }: { note: NoteSummary }) {
  const t = useT();
  const path = note.preview.imagePaths?.[0] ?? null;
  const url = useSignedUrl(path);
  return (
    <div className="card-pic" data-loaded={Boolean(url)}>
      {url ? (
        <img src={url} alt={note.title || t("card.kind.pic")} loading="lazy" draggable={false} />
      ) : null}
    </div>
  );
}

/** Link card header: thumbnail through the proxy or a pattern tile, play badge, duration. */
export function LinkMedia({ note }: { note: NoteSummary }) {
  const link = note.preview.link;
  const image = link?.image ? `/api/img?u=${encodeURIComponent(link.image)}` : null;
  const isVideo = link?.mediaType === "video";
  return (
    <div className="card-link" data-kind={link?.mediaType ?? "article"}>
      {image ? (
        <img src={image} alt="" loading="lazy" draggable={false} />
      ) : link?.mediaType === "maps" ? (
        <MapPin size={36} strokeWidth={2.4} aria-hidden="true" />
      ) : (
        <Link2 size={36} strokeWidth={2.4} aria-hidden="true" />
      )}
      {isVideo && (
        <span className="card-link__play" aria-hidden="true">
          <Play size={18} strokeWidth={2.6} />
        </span>
      )}
      {link?.duration ? (
        <span className="card-link__duration sc-mono">{formatClock(link.duration * 1000)}</span>
      ) : null}
    </div>
  );
}

/** Play button and waveform: plays inline without opening the note. */
export function VoiceMedia({ note }: { note: NoteSummary }) {
  const t = useT();
  const voice = note.preview.voice;
  const url = useSignedUrl(voice?.path ?? null);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const total = voice?.durationMs ?? 0;

  return (
    <div className="card-voice">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- transcripts arrive in Phase 8 */}
      <audio
        ref={audio}
        src={url ?? undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime * 1000)}
      />
      <button
        type="button"
        className="card-voice__play"
        aria-label={playing ? t("card.voice.pause") : t("card.voice.play")}
        disabled={!url}
        onClick={() => {
          const el = audio.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
      >
        {playing ? (
          <Pause size={20} strokeWidth={2.6} aria-hidden="true" />
        ) : (
          <Play size={20} strokeWidth={2.6} aria-hidden="true" />
        )}
      </button>
      <Waveform
        peaks={(voice?.peaks ?? []).slice(0, 48)}
        progress={total ? position / total : 0}
        height={32}
        className="card-voice__wave"
      />
      <span className="sc-mono card-voice__time">
        {formatClock(playing || position > 0 ? position : total)}
      </span>
    </div>
  );
}
