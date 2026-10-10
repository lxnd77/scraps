"use client";

import { uuidv7, type NotesPage } from "@scraps/db";
import { Button, Sheet, SpaceDot } from "@scraps/ui";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Clipboard, Image as ImageIcon, Link2, ListChecks, Mic, Smile, Type } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { useShell } from "@/components/shell/ShellContext";
import type { CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import { FUNCTIONAL_CAPTURE_TYPES, buildCapture, type CaptureType } from "@/lib/capture";
import { createNote } from "@/lib/notes";
import { freshNoteIds, summaryFromDraft } from "@/lib/optimistic";

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
  const { spaces } = useShell();
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

  useEffect(() => {
    const id = window.setTimeout(() => area.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  const functional = FUNCTIONAL_CAPTURE_TYPES.includes(type);
  const draft = functional ? buildCapture(type as "text" | "list", text) : null;
  const canSave = Boolean(draft && spaceId) && !saving;

  async function save() {
    if (!draft || !spaceId || saving) return;
    setSaving(true);
    setFailed(false);
    const id = uuidv7();
    try {
      await createNote({
        id,
        spaceId,
        start: draft.start,
        title: draft.title,
        text: draft.text,
        items: draft.items,
      });
    } catch {
      setFailed(true);
      setSaving(false);
      return;
    }

    // the card appears at once; the refetch below confirms it
    freshNoteIds.add(id);
    const summary = summaryFromDraft({ id, spaceId, draft });
    queryClient.setQueryData<InfiniteData<NotesPage, number>>(["board", spaceId, null], (old) => {
      if (!old) return old;
      const [first, ...rest] = old.pages;
      if (!first) return old;
      const at = first.notes.findIndex((n) => !n.pinned);
      const notes = [...first.notes];
      notes.splice(at === -1 ? notes.length : at, 0, summary);
      return { ...old, pages: [{ ...first, notes }, ...rest] };
    });
    void queryClient.invalidateQueries({ queryKey: ["board", spaceId] });
    void queryClient.invalidateQueries({ queryKey: ["kinds", spaceId] });
    void queryClient.invalidateQueries({ queryKey: ["streak"] });
    setSaving(false);
    onClose();
    const boardPath = `/s/${spaceId}`;
    if (pathname !== boardPath && pathname !== "/") router.push(boardPath);
    else router.refresh(); // sidebar counts
  }

  async function pasteFromClipboard() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setText((current) => (current ? `${current}\n${value}` : value));
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
        {!functional && (
          <p role="status" className="field-hint">
            {t("coming.soon")}
          </p>
        )}
      </div>

      <div className="capture__clip">
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
