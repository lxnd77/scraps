"use client";

import { Sticker, Tape, Waveform, type StickerId } from "@scraps/ui";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Link2,
  Mic,
  Pause,
  Play,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { MoodImage } from "../extensions";
import { useMedia, type MediaApi } from "./media";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif";

function messageFor(error: unknown): string {
  return error instanceof Error && error.message && !/^[a-z_]+$/.test(error.message)
    ? error.message
    : "couldn't upload that pic. try again.";
}

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Picture with the loading box in its dominant colour, so layout never jumps. */
function Picture({
  path,
  alt,
  width,
  height,
  color,
}: {
  path: string | null;
  alt: string;
  width: number | null;
  height: number | null;
  color: string | null;
}) {
  const media = useMedia();
  const url = media.useSignedUrl(path);
  const [loaded, setLoaded] = useState(false);
  const ratio = width && height ? `${width} / ${height}` : "4 / 3";
  return (
    <div
      className="scrap-pic"
      style={{ aspectRatio: ratio, backgroundColor: color ?? "var(--surface-2)" }}
      data-loaded={loaded}
    >
      {url && <img src={url} alt={alt} onLoad={() => setLoaded(true)} draggable={false} />}
    </div>
  );
}

// ---- image ----------------------------------------------------------------------------

export function ImageView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const media = useMedia();
  const attrs = node.attrs as {
    assetId: string | null;
    path: string | null;
    caption: string;
    alt: string;
    polaroid: boolean;
    width: number | null;
    height: number | null;
    color: string | null;
  };
  const editable = editor.isEditable;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const up = await media.uploadImage(file);
      updateAttributes({
        assetId: up.assetId,
        path: up.path,
        width: up.width,
        height: up.height,
        color: up.color,
      });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  if (!attrs.path) {
    return (
      <NodeViewWrapper className="scrap-media scrap-media--empty" data-type="image">
        <div contentEditable={false}>
          <button
            type="button"
            className="scrap-media__drop"
            disabled={!editable || busy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={28} strokeWidth={2.4} aria-hidden="true" />
            <span>{busy ? "uploading…" : "add a pic"}</span>
          </button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            hidden
            aria-label="choose a pic"
            onChange={(e) => void choose(e)}
          />
          {error && (
            <p role="alert" className="scrap-media__error">
              {error}
            </p>
          )}
          {editable && (
            <button type="button" className="scrap-media__link" onClick={() => deleteNode()}>
              remove
            </button>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper
      className="scrap-media scrap-image"
      data-type="image"
      data-polaroid={attrs.polaroid}
    >
      <figure contentEditable={false} className={attrs.polaroid ? "scrap-polaroid" : undefined}>
        {attrs.polaroid && <Tape className="scrap-polaroid__tape" />}
        <Picture
          path={attrs.path}
          alt={attrs.alt || attrs.caption || "picture"}
          width={attrs.width}
          height={attrs.height}
          color={attrs.color}
        />
        {editable ? (
          <input
            className="scrap-caption"
            aria-label="caption"
            placeholder="add a caption"
            value={attrs.caption}
            onChange={(e) => updateAttributes({ caption: e.target.value })}
          />
        ) : (
          attrs.caption && <figcaption className="scrap-caption">{attrs.caption}</figcaption>
        )}
        {editable && (
          <div className="scrap-media__tools">
            <input
              className="scrap-alt"
              aria-label="alt text"
              placeholder="alt text for screen readers"
              value={attrs.alt}
              onChange={(e) => updateAttributes({ alt: e.target.value })}
            />
            <button
              type="button"
              className="scrap-media__link"
              aria-pressed={attrs.polaroid}
              onClick={() => updateAttributes({ polaroid: !attrs.polaroid })}
            >
              polaroid
            </button>
            <button
              type="button"
              className="scrap-media__icon"
              aria-label="remove pic"
              onClick={() => deleteNode()}
            >
              <Trash2 size={16} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
        )}
      </figure>
    </NodeViewWrapper>
  );
}

// ---- mood board -----------------------------------------------------------------------

export function MoodBoardView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const media = useMedia();
  const images = (node.attrs.images ?? []) as MoodImage[];
  const editable = editor.isEditable;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function add(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 9 - images.length);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const added: MoodImage[] = [];
      for (const file of files) {
        const up = await media.uploadImage(file);
        added.push({ assetId: up.assetId, path: up.path, caption: "" });
      }
      updateAttributes({ images: [...images, ...added] });
    } catch (e) {
      setError(messageFor(e));
    } finally {
      setBusy(false);
    }
  }

  function patch(index: number, change: Partial<MoodImage>) {
    updateAttributes({ images: images.map((im, i) => (i === index ? { ...im, ...change } : im)) });
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= images.length) return;
    const next = [...images];
    [next[index], next[to]] = [next[to]!, next[index]!];
    updateAttributes({ images: next });
  }

  function remove(index: number) {
    const next = images.filter((_, i) => i !== index);
    if (next.length === 0) deleteNode();
    else updateAttributes({ images: next });
  }

  return (
    <NodeViewWrapper className="scrap-media scrap-mood" data-type="moodBoard">
      <div contentEditable={false}>
        <ul className="scrap-mood__grid" aria-label="mood board">
          {images.map((im, i) => (
            <li
              key={im.assetId + i}
              className="scrap-mood__item"
              style={{ ["--tilt" as string]: i % 2 === 0 ? "-1.5deg" : "1.5deg" }}
            >
              <div className="scrap-polaroid">
                <Tape className="scrap-polaroid__tape" />
                <Picture
                  path={im.path}
                  alt={im.alt || im.caption || `picture ${i + 1}`}
                  width={null}
                  height={null}
                  color={null}
                />
                {editable ? (
                  <input
                    className="scrap-caption"
                    aria-label={`caption for picture ${i + 1}`}
                    placeholder="caption"
                    value={im.caption ?? ""}
                    onChange={(e) => patch(i, { caption: e.target.value })}
                  />
                ) : (
                  im.caption && <p className="scrap-caption">{im.caption}</p>
                )}
              </div>
              {editable && (
                <div className="scrap-mood__tools">
                  <button
                    type="button"
                    className="scrap-media__icon"
                    aria-label={`move picture ${i + 1} earlier`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowLeft size={16} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="scrap-media__icon"
                    aria-label={`move picture ${i + 1} later`}
                    disabled={i === images.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowRight size={16} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="scrap-media__icon"
                    aria-label={`remove picture ${i + 1}`}
                    onClick={() => remove(i)}
                  >
                    <X size={16} strokeWidth={2.6} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {editable && images.length < 9 && (
          <>
            <button
              type="button"
              className="scrap-media__drop scrap-media__drop--slim"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <ImagePlus size={22} strokeWidth={2.4} aria-hidden="true" />
              <span>{busy ? "uploading…" : images.length === 0 ? "add pics" : "add more"}</span>
            </button>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              aria-label="choose pics"
              onChange={(e) => void add(e)}
            />
          </>
        )}
        {error && (
          <p role="alert" className="scrap-media__error">
            {error}
          </p>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ---- link embed -----------------------------------------------------------------------

function formatDuration(seconds: number): string {
  return formatClock(seconds * 1000);
}

export function LinkEmbedView({
  node,
  editor,
  updateAttributes,
  deleteNode,
  getPos,
}: NodeViewProps) {
  const media = useMedia();
  const attrs = node.attrs as {
    url: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
    domain: string | null;
    duration: number | null;
    mediaType: "article" | "video" | "maps";
    pin: { lat: number; lng: number } | null;
  };
  const editable = editor.isEditable;
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "failed">("idle");
  const fetchedFor = useRef<string | null>(null);

  // unfurl once per url when the card has nothing but the address
  useEffect(() => {
    const url = attrs.url;
    if (!url || attrs.title || !editable || fetchedFor.current === url) return;
    fetchedFor.current = url;
    setState("loading");
    media
      .unfurl(url)
      .then((p) => {
        updateAttributes({
          title: p.title,
          description: p.description,
          image: p.image,
          domain: p.domain,
          duration: p.duration,
          mediaType: p.mediaType,
          pin: p.pin,
        });
        setState("idle");
      })
      .catch(() => setState("failed"));
    // updateAttributes and media are stable for the life of the node view
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attrs.url, attrs.title, editable]);

  /** "keep as link": swap the card for the plain address as a link in a paragraph. */
  function keepAsLink() {
    const pos = getPos();
    if (typeof pos !== "number" || !attrs.url) return;
    editor
      .chain()
      .focus()
      .insertContentAt(
        { from: pos, to: pos + node.nodeSize },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: attrs.url,
              marks: [{ type: "link", attrs: { href: attrs.url } }],
            },
          ],
        },
      )
      .run();
  }

  if (!attrs.url) {
    return (
      <NodeViewWrapper className="scrap-media scrap-link scrap-link--empty" data-type="linkEmbed">
        <form
          contentEditable={false}
          className="scrap-link__form"
          onSubmit={(e) => {
            e.preventDefault();
            const value = draft.trim();
            if (/^https?:\/\//i.test(value)) updateAttributes({ url: value });
          }}
        >
          <Link2 size={20} strokeWidth={2.4} aria-hidden="true" />
          <input
            className="scrap-link__input"
            aria-label="link address"
            placeholder="paste a link"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!editable}
          />
          <button type="submit" className="scrap-media__link" disabled={!editable}>
            embed
          </button>
          {editable && (
            <button
              type="button"
              className="scrap-media__icon"
              aria-label="remove"
              onClick={() => deleteNode()}
            >
              <X size={16} strokeWidth={2.6} aria-hidden="true" />
            </button>
          )}
        </form>
      </NodeViewWrapper>
    );
  }

  const image = attrs.image ? media.imageProxyUrl(attrs.image) : null;
  return (
    <NodeViewWrapper
      className="scrap-media scrap-link"
      data-type="linkEmbed"
      data-media={attrs.mediaType}
    >
      <div contentEditable={false}>
        <a className="scrap-link__card" href={attrs.url} target="_blank" rel="noopener noreferrer">
          <span className="scrap-link__media" data-kind={attrs.mediaType}>
            {image ? (
              <img src={image} alt="" draggable={false} />
            ) : (
              <Link2 size={32} strokeWidth={2.4} aria-hidden="true" />
            )}
            {attrs.mediaType === "video" && (
              <span className="scrap-link__play" aria-hidden="true">
                <Play size={20} strokeWidth={2.6} />
              </span>
            )}
            {attrs.duration ? (
              <span className="scrap-link__duration sc-mono">{formatDuration(attrs.duration)}</span>
            ) : null}
            {attrs.mediaType === "maps" && attrs.pin && (
              <span className="scrap-link__pin sc-mono">
                {attrs.pin.lat.toFixed(3)}, {attrs.pin.lng.toFixed(3)}
              </span>
            )}
          </span>
          <span className="scrap-link__text">
            <span className="scrap-link__domain sc-mono">{attrs.domain ?? attrs.url}</span>
            <span className="scrap-link__title">
              {state === "loading" ? "fetching preview…" : (attrs.title ?? attrs.url)}
            </span>
            {attrs.description && <span className="scrap-link__desc">{attrs.description}</span>}
          </span>
        </a>
        {editable && (
          <div className="scrap-media__tools">
            <button type="button" className="scrap-media__link" onClick={keepAsLink}>
              keep as link
            </button>
            <button
              type="button"
              className="scrap-media__icon"
              aria-label="remove link card"
              onClick={() => deleteNode()}
            >
              <Trash2 size={16} strokeWidth={2.6} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ---- voice memo -----------------------------------------------------------------------

function Recorder({
  media,
  onDone,
  onCancel,
}: {
  media: MediaApi;
  onDone: (r: { assetId: string; path: string; durationMs: number; peaks: number[] }) => void;
  onCancel: () => void;
}) {
  const rec = media.useRecorder();
  const warn = rec.elapsedMs >= 4.5 * 60 * 1000;

  return (
    <div className="scrap-voice__recorder">
      {rec.state === "idle" || rec.state === "denied" || rec.state === "error" ? (
        <>
          <button
            type="button"
            className="scrap-voice__rec"
            onClick={() => void rec.start()}
            aria-label="start recording"
          >
            <Mic size={22} strokeWidth={2.6} aria-hidden="true" />
            <span>record</span>
          </button>
          <button type="button" className="scrap-media__link" onClick={onCancel}>
            cancel
          </button>
          {rec.state === "denied" && (
            <p role="alert" className="scrap-media__error">
              we need the mic to record. allow it in your browser and try again.
            </p>
          )}
          {rec.state === "error" && (
            <p role="alert" className="scrap-media__error">
              couldn't record that. try again.
            </p>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            className="scrap-voice__rec scrap-voice__rec--live"
            aria-label="stop recording"
            disabled={rec.state !== "recording"}
            onClick={() =>
              void rec.stop().then((result) => {
                if (result) onDone(result);
              })
            }
          >
            <Square size={20} strokeWidth={2.6} aria-hidden="true" />
          </button>
          <span className="scrap-voice__clock sc-mono" role="timer" data-warn={warn}>
            {rec.state === "saving" ? "saving…" : formatClock(rec.elapsedMs)}
          </span>
          <Waveform peaks={rec.peaks.slice(-64)} className="scrap-voice__wave" />
          {warn && rec.state === "recording" && (
            <span role="status" className="scrap-voice__warn sc-mono">
              30 seconds left
            </span>
          )}
          <button
            type="button"
            className="scrap-media__link"
            onClick={() => {
              rec.cancel();
              onCancel();
            }}
          >
            cancel
          </button>
        </>
      )}
    </div>
  );
}

/** Play, pause and scrub a stored memo. */
export function VoicePlayer({
  path,
  peaks,
  durationMs,
  className,
}: {
  path: string | null;
  peaks: number[];
  durationMs: number | null;
  className?: string;
}) {
  const media = useMedia();
  const url = media.useSignedUrl(path);
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const total = durationMs ?? 0;

  function toggle() {
    const el = audio.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function seek(fraction: number) {
    const el = audio.current;
    if (!el || !total) return;
    el.currentTime = (Math.min(1, Math.max(0, fraction)) * total) / 1000;
    setPosition(el.currentTime * 1000);
  }

  return (
    <div className={className ?? "scrap-voice__player"}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- transcripts arrive with Phase 8 */}
      <audio
        ref={audio}
        src={url ?? undefined}
        preload="metadata"
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
        className="scrap-voice__play"
        aria-label={playing ? "pause memo" : "play memo"}
        disabled={!url}
        onClick={toggle}
      >
        {playing ? (
          <Pause size={20} strokeWidth={2.6} aria-hidden="true" />
        ) : (
          <Play size={20} strokeWidth={2.6} aria-hidden="true" />
        )}
      </button>
      <input
        type="range"
        className="scrap-voice__scrub"
        aria-label="seek"
        min={0}
        max={1000}
        value={total ? Math.round((position / total) * 1000) : 0}
        onChange={(e) => seek(Number(e.target.value) / 1000)}
      />
      <Waveform
        peaks={peaks}
        progress={total ? position / total : 0}
        className="scrap-voice__wave"
      />
      <span className="scrap-voice__clock sc-mono">
        {formatClock(playing || position > 0 ? position : total)}
      </span>
    </div>
  );
}

export function VoiceMemoView({ node, editor, updateAttributes, deleteNode }: NodeViewProps) {
  const media = useMedia();
  const attrs = node.attrs as {
    assetId: string | null;
    path: string | null;
    durationMs: number | null;
    peaks: number[];
    authorName: string;
  };
  const editable = editor.isEditable;

  if (!attrs.path) {
    return (
      <NodeViewWrapper className="scrap-media scrap-voice" data-type="voiceMemo">
        <div contentEditable={false}>
          {editable ? (
            <Recorder
              media={media}
              onCancel={() => deleteNode()}
              onDone={(r) =>
                updateAttributes({
                  assetId: r.assetId,
                  path: r.path,
                  durationMs: r.durationMs,
                  peaks: r.peaks,
                  authorId: media.currentUser.id,
                  authorName: media.currentUser.name,
                })
              }
            />
          ) : (
            <p className="scrap-voice__empty">no recording yet</p>
          )}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="scrap-media scrap-voice" data-type="voiceMemo">
      <div contentEditable={false}>
        <VoicePlayer path={attrs.path} peaks={attrs.peaks} durationMs={attrs.durationMs} />
        <div className="scrap-voice__meta">
          {attrs.authorName && <span className="sc-mono">{attrs.authorName}</span>}
          {editable && (
            <button
              type="button"
              className="scrap-media__icon"
              aria-label="remove memo"
              onClick={() => deleteNode()}
            >
              <Trash2 size={16} strokeWidth={2.6} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ---- sticker --------------------------------------------------------------------------

export function StickerView({ node }: NodeViewProps) {
  const id = String(node.attrs.id ?? "sparkle") as StickerId;
  const size = Number(node.attrs.size ?? 64);
  return (
    <NodeViewWrapper as="span" className="scrap-sticker" data-type="sticker">
      <span contentEditable={false}>
        <Sticker id={id} size={size} />
      </span>
    </NodeViewWrapper>
  );
}
