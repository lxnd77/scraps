"use client";

import { uuidv7 } from "@scraps/db";
import {
  Button,
  STICKER_IDS,
  Sheet,
  SpaceDot,
  Sticker,
  Waveform,
  type StickerId,
} from "@scraps/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Clipboard, Image as ImageIcon, Link2, ListChecks, Mic, Smile, Type } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useAi } from "@/components/ai/AiProvider";
import { useShell } from "@/components/shell/ShellContext";
import type { CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import { buildCapture, type CaptureType } from "@/lib/capture";
import {
  captureImage,
  captureLink,
  captureMoodBoard,
  captureSticker,
  captureVoice,
} from "@/lib/captureMedia";
import { asUrl } from "@/lib/capture";
import { formatClock } from "@/lib/media/audio";
import { AudioFileError, clipFromFile } from "@/lib/media/audioFile";
import { ImageError } from "@/lib/media/image";
import { MAX_SHARED_IMAGES, shareKind, type SharePayload } from "@/lib/share/payload";
import { useRecorder, type RecordedClip } from "@/lib/media/useRecorder";
import { createNote } from "@/lib/notes";
import { flushOutbox } from "@/lib/offline/runtime";

type TileIcon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;

const TILES: Array<{ type: CaptureType; key: CopyKey; Icon: TileIcon }> = [
  { type: "text", key: "capture.type.text", Icon: Type },
  { type: "list", key: "capture.type.list", Icon: ListChecks },
  { type: "pic", key: "capture.type.pic", Icon: ImageIcon },
  { type: "link", key: "capture.type.link", Icon: Link2 },
  { type: "voice", key: "capture.type.voice", Icon: Mic },
  { type: "sticker", key: "capture.type.sticker", Icon: Smile },
];

interface Props {
  open: boolean;
  onClose: () => void;
  defaultSpaceId: string;
  initialText: string;
  /** what another app shared, or what was dropped on the board (phase 7) */
  share?: SharePayload;
}

/** Quick capture (SPEC 6.4): bottom sheet on phones, centred modal on desktop. */
export function CaptureSheet({ open, onClose, defaultSpaceId, initialText, share }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("capture.title")} className="capture">
      {/* mounted only while open, so every capture starts from a clean form */}
      {open && (
        <CaptureForm
          onClose={onClose}
          defaultSpaceId={defaultSpaceId}
          initialText={initialText}
          share={share}
        />
      )}
    </Sheet>
  );
}

/** The tile and starting text a shared payload opens the sheet with. */
function startFromShare(
  share: SharePayload | undefined,
): { type: CaptureType; text: string } | null {
  const kind = share ? shareKind(share) : null;
  if (!share || !kind) return null;
  if (kind === "text") {
    return { type: "text", text: [share.title, share.text].filter(Boolean).join("\n") };
  }
  const title = share.title ?? share.text ?? "";
  if (kind === "link") return { type: "link", text: title };
  if (kind === "voice") return { type: "voice", text: title };
  return { type: "pic", text: title };
}

function CaptureForm({ onClose, defaultSpaceId, initialText, share }: Omit<Props, "open">) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { spaces, user, profile } = useShell();
  const ai = useAi();
  const editableSpaces = spaces.filter((s) => s.role !== "viewer");

  const shared = startFromShare(share);
  const [type, setType] = useState<CaptureType>(shared?.type ?? "text");
  const [text, setText] = useState(shared?.text ?? initialText);
  const [spaceId, setSpaceId] = useState(
    editableSpaces.some((s) => s.id === defaultSpaceId)
      ? defaultSpaceId
      : (editableSpaces[0]?.id ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>(() =>
    (share?.files ?? []).filter((f) => f.type.startsWith("image/") || !f.type),
  );
  const [link, setLink] = useState(share?.url ?? "");
  const [sticker, setSticker] = useState<string | null>(null);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // a shared audio file becomes the voice memo once it is decoded (duration and waveform)
  useEffect(() => {
    const audio = share?.files.find((f) => f.type.startsWith("audio/"));
    if (!audio || shared?.type !== "voice") return;
    let cancelled = false;
    clipFromFile(audio)
      .then((decoded) => {
        if (!cancelled) setClip(decoded);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProblem(
          error instanceof AudioFileError && error.problem === "too_long"
            ? t("capture.voice.too_long")
            : t("capture.voice.unreadable"),
        );
      });
    return () => {
      cancelled = true;
    };
    // the payload is fixed for the life of this form
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the recorder hands the clip back instead of uploading: the note must exist first
  const keepClip = useCallback(async (recorded: RecordedClip) => {
    setClip(recorded);
    return { assetId: "", path: "", durationMs: recorded.durationMs, peaks: recorded.peaks };
  }, []);
  const recorder = useRecorder(keepClip);

  useEffect(() => {
    const id = window.setTimeout(() => area.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  const isTextual = type === "text" || type === "list";
  const draft = isTextual ? buildCapture(type as "text" | "list", text) : null;
  const firstLine = text
    .split("\n")
    .find((l) => l.trim())
    ?.trim()
    .slice(0, 120);
  const linkUrl = asUrl(link);
  const ready =
    type === "pic"
      ? files.length > 0
      : type === "link"
        ? Boolean(linkUrl)
        : type === "voice"
          ? Boolean(clip)
          : type === "sticker"
            ? Boolean(sticker)
            : Boolean(draft);
  const canSave = ready && Boolean(spaceId) && !saving && recorder.state !== "recording";

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setFailed(false);
    setProblem(null);
    const id = uuidv7();
    let savedId: string | null = null;
    try {
      if (isTextual && draft) {
        savedId = await createNote({
          id,
          spaceId,
          start: draft.start,
          title: draft.title,
          text: draft.text,
          items: draft.items,
        });
      } else if (type === "pic" && files.length > 1) {
        savedId = await captureMoodBoard({ spaceId, files, title: firstLine });
      } else if (type === "pic" && files.length === 1) {
        savedId = await captureImage({ spaceId, file: files[0]!, title: firstLine });
      } else if (type === "link" && linkUrl) {
        savedId = await captureLink({ spaceId, url: linkUrl, title: firstLine });
      } else if (type === "voice" && clip) {
        savedId = await captureVoice({
          spaceId,
          clip,
          author: { id: user.id, name: profile.displayName },
          title: firstLine,
        });
      } else if (type === "sticker" && sticker) {
        savedId = await captureSticker({ spaceId, sticker, title: firstLine });
      }
    } catch (error) {
      if (error instanceof ImageError) {
        setProblem(
          error.problem === "unreadable"
            ? t("capture.pic.unreadable")
            : error.problem === "too_big"
              ? t("capture.pic.too_big")
              : t("capture.pic.type"),
        );
      } else {
        setFailed(true);
      }
      setSaving(false);
      return;
    }

    // The card is already on the board (the shell listens for new scraps). Refetch only once the
    // outbox has delivered the create: an earlier answer would not list it and would erase the card.
    void flushOutbox().then(() => {
      if (navigator.onLine === false) return;
      void queryClient.invalidateQueries({ queryKey: ["board", spaceId] });
      void queryClient.invalidateQueries({ queryKey: ["kinds", spaceId] });
      void queryClient.invalidateQueries({ queryKey: ["streak"] });
    });
    setSaving(false);
    onClose();
    // after the card is on the board: ask to opt in the first time, then suggest where it goes
    if (savedId) ai.afterCapture(savedId, spaceId);
    const boardPath = `/s/${spaceId}`;
    if (pathname !== boardPath && pathname !== "/") router.push(boardPath);
    else if (navigator.onLine !== false) router.refresh(); // sidebar counts
  }

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) {
        if (type === "link") setLink(value.trim());
        else setText((current) => (current ? `${current}\n${value}` : value));
      }
    } catch {
      // permission denied or no clipboard access: the textarea still takes a normal paste
    }
    area.current?.focus();
  }

  return (
    <form
      className="capture__form"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {share && (
        <p role="status" className="sc-mono capture__shared">
          {t("capture.shared")}
        </p>
      )}
      <label className="field-label" htmlFor="capture-text">
        {t("capture.label")}
      </label>
      <textarea
        id="capture-text"
        ref={area}
        className="capture__text"
        rows={4}
        value={text}
        placeholder={t("capture.placeholder")}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void save();
          }
        }}
      />
      {type === "list" && <p className="field-hint">{t("capture.list.hint")}</p>}

      <div role="radiogroup" aria-label={t("capture.types")} className="capture__types">
        <span className="field-label" aria-hidden="true">
          {t("capture.types")}
        </span>
        <div className="capture__tiles">
          {TILES.map(({ type: tileType, key, Icon }) => (
            <button
              key={tileType}
              type="button"
              role="radio"
              aria-checked={type === tileType}
              className="capture__tile"
              onClick={() => setType(tileType)}
            >
              <Icon size={24} strokeWidth={2.4} aria-hidden={true} />
              <span>{t(key)}</span>
            </button>
          ))}
        </div>
      </div>

      {type === "pic" && (
        <div className="capture__panel">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            multiple
            hidden
            aria-label={t("capture.pic.choose")}
            onChange={(event) => {
              setFiles(Array.from(event.target.files ?? []).slice(0, MAX_SHARED_IMAGES));
              setProblem(null);
            }}
          />
          <Button type="button" variant="ghost" onClick={() => fileInput.current?.click()}>
            <ImageIcon size={18} strokeWidth={2.6} aria-hidden="true" />
            {files.length > 0 ? t("capture.pic.change") : t("capture.pic.choose")}
          </Button>
          {files.length === 1 && <span className="sc-mono capture__file">{files[0]!.name}</span>}
          {files.length > 1 && (
            <span className="sc-mono capture__file">
              {t("capture.pic.board", { n: files.length })}
            </span>
          )}
        </div>
      )}

      {type === "link" && (
        <div className="capture__panel">
          <label className="field-label" htmlFor="capture-link">
            {t("capture.link.label")}
          </label>
          <input
            id="capture-link"
            type="url"
            inputMode="url"
            className="field-input"
            placeholder="https://"
            value={link}
            onChange={(event) => setLink(event.target.value)}
          />
          {link && !linkUrl && <p className="field-hint">{t("capture.link.invalid")}</p>}
        </div>
      )}

      {type === "voice" && (
        <div className="capture__panel">
          {clip ? (
            <>
              <span className="sc-mono">{formatClock(clip.durationMs)}</span>
              <Waveform peaks={clip.peaks.slice(0, 48)} height={32} className="capture__wave" />
              <Button type="button" variant="ghost" onClick={() => setClip(null)}>
                {t("capture.voice.redo")}
              </Button>
            </>
          ) : recorder.state === "recording" || recorder.state === "saving" ? (
            <>
              <Button
                type="button"
                variant="dark"
                aria-label={t("capture.voice.stop")}
                onClick={() => void recorder.stop()}
              >
                {t("capture.voice.stop")}
              </Button>
              <span className="sc-mono" role="timer">
                {formatClock(recorder.elapsedMs)}
              </span>
              <Waveform peaks={recorder.peaks.slice(-48)} height={32} className="capture__wave" />
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={() => void recorder.start()}>
                <Mic size={18} strokeWidth={2.6} aria-hidden="true" />
                {t("capture.voice.record")}
              </Button>
              {recorder.state === "denied" && (
                <p role="alert" className="field-error">
                  {t("capture.voice.denied")}
                </p>
              )}
              {recorder.state === "error" && (
                <p role="alert" className="field-error">
                  {t("capture.voice.error")}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {type === "sticker" && (
        <ul className="capture__stickers" role="radiogroup" aria-label={t("capture.type.sticker")}>
          {STICKER_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                role="radio"
                aria-checked={sticker === id}
                aria-label={id}
                className="capture__sticker"
                onClick={() => setSticker(id)}
              >
                <Sticker id={id as StickerId} size={44} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {problem && (
        <p role="alert" className="field-error">
          {problem}
        </p>
      )}

      <div className="capture__clip" hidden={type === "voice" || type === "sticker"}>
        <span>{t("capture.clipboard")}</span>
        <Button type="button" variant="ghost" onClick={() => void pasteFromClipboard()}>
          <Clipboard size={16} strokeWidth={2.6} aria-hidden="true" />
          {t("capture.paste")}
        </Button>
      </div>

      {failed && (
        <p role="alert" className="field-error">
          {t("capture.error")}
        </p>
      )}

      <div className="capture__footer">
        <label className="capture__space">
          <span className="sr-only">{t("capture.space")}</span>
          <SpaceDot color={spaces.find((s) => s.id === spaceId)?.color ?? "yellow"} />
          <select
            value={spaceId}
            onChange={(event) => setSpaceId(event.target.value)}
            className="capture__select"
          >
            {editableSpaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" disabled={!canSave}>
          {saving ? t("capture.saving") : t("capture.save")}
        </Button>
      </div>
    </form>
  );
}
