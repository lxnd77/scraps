"use client";

import { STICKER_PACK } from "@scraps/editor/react";
import { uuidv7 } from "@scraps/db";
import { Button, Sheet, SpaceDot, Sticker, Waveform, type StickerId } from "@scraps/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Clipboard, Image as ImageIcon, Link2, ListChecks, Mic, Smile, Type } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useShell } from "@/components/shell/ShellContext";
import type { CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import { buildCapture, type CaptureType } from "@/lib/capture";
import { captureImage, captureLink, captureSticker, captureVoice } from "@/lib/captureMedia";
import { asUrl } from "@/lib/capture";
import { formatClock } from "@/lib/media/audio";
import { ImageError } from "@/lib/media/image";
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
}

/** Quick capture (SPEC 6.4): bottom sheet on phones, centred modal on desktop. */
export function CaptureSheet({ open, onClose, defaultSpaceId, initialText }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("capture.title")} className="capture">
      {/* mounted only while open, so every capture starts from a clean form */}
      {open && (
        <CaptureForm onClose={onClose} defaultSpaceId={defaultSpaceId} initialText={initialText} />
      )}
    </Sheet>
  );
}

function CaptureForm({ onClose, defaultSpaceId, initialText }: Omit<Props, "open">) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { spaces, user, profile } = useShell();
  const editableSpaces = spaces.filter((s) => s.role !== "viewer");

  const [type, setType] = useState<CaptureType>("text");
  const [text, setText] = useState(initialText);
  const [spaceId, setSpaceId] = useState(
    editableSpaces.some((s) => s.id === defaultSpaceId)
      ? defaultSpaceId
      : (editableSpaces[0]?.id ?? ""),
  );
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [sticker, setSticker] = useState<string | null>(null);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

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
      ? Boolean(file)
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
    try {
      if (isTextual && draft) {
        await createNote({
          id,
          spaceId,
          start: draft.start,
          title: draft.title,
          text: draft.text,
          items: draft.items,
        });
      } else if (type === "pic" && file) {
        await captureImage({ spaceId, file, title: firstLine });
      } else if (type === "link" && linkUrl) {
        await captureLink({ spaceId, url: linkUrl, title: firstLine });
      } else if (type === "voice" && clip) {
        await captureVoice({
          spaceId,
          clip,
          author: { id: user.id, name: profile.displayName },
          title: firstLine,
        });
      } else if (type === "sticker" && sticker) {
        await captureSticker({ spaceId, sticker, title: firstLine });
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
            hidden
            aria-label={t("capture.pic.choose")}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setProblem(null);
            }}
          />
          <Button type="button" variant="ghost" onClick={() => fileInput.current?.click()}>
            <ImageIcon size={18} strokeWidth={2.6} aria-hidden="true" />
            {file ? t("capture.pic.change") : t("capture.pic.choose")}
          </Button>
          {file && <span className="sc-mono capture__file">{file.name}</span>}
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
          {STICKER_PACK.map((id) => (
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
