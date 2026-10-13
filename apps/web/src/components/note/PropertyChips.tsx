"use client";

import { uuidv7, type NoteDetail, type NoteTag } from "@scraps/db";
import { PropertyChip, TagChip } from "@scraps/ui";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/copy/useT";
import { queue } from "@/lib/offline/runtime";
import { dayLabel } from "@/lib/relativeTime";

interface Props {
  note: NoteDetail;
  spaceTags: NoteTag[];
  editable: boolean;
  onProps: (props: { vibe?: string; when?: string }) => Promise<void>;
  onError: () => void;
}

/** vibe, when, and tags (SPEC 6.3). Tags go through PostgREST under RLS like every metadata write. */
export function PropertyChips({ note, spaceTags, editable, onProps, onError }: Props) {
  const t = useT();
  const listId = useId();
  const [tags, setTags] = useState<NoteTag[]>(note.tags);
  const [known, setKnown] = useState<NoteTag[]>(spaceTags);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [when, setWhen] = useState(note.props.when ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // move focus into the new-tag field when it opens
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, "").slice(0, 40);
    if (!name) return;
    if (tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) return;

    // a tag that exists in the space is reused; a new one gets its id here so it works offline
    let tag = known.find((k) => k.name.toLowerCase() === name.toLowerCase());
    const isNew = !tag;
    if (!tag) {
      tag = { id: uuidv7(), name, color: "lilac" };
      setKnown((list) => [...list, tag!]);
    }
    setTags((list) => [...list, tag!]);
    try {
      await queue({
        type: "tagAdd",
        noteId: note.id,
        spaceId: note.spaceId,
        tagId: tag.id,
        name: tag.name,
        color: tag.color,
      });
    } catch {
      setTags((list) => list.filter((x) => x.id !== tag!.id));
      if (isNew) setKnown((list) => list.filter((x) => x.id !== tag!.id));
      onError();
    }
  }

  async function removeTag(tag: NoteTag) {
    setTags((list) => list.filter((x) => x.id !== tag.id));
    try {
      await queue({ type: "tagRemove", noteId: note.id, tagId: tag.id });
    } catch {
      setTags((list) => [...list, tag]);
      onError();
    }
  }

  async function submitDraft() {
    const value = draft;
    setDraft("");
    setAdding(false);
    await addTag(value);
  }

  return (
    <div className="chips" role="group" aria-label="properties">
      {editable ? (
        <>
          <label className="chip-field">
            <span className="chip-field__key">{t("note.chip.vibe")}</span>
            <input
              className="chip-field__input"
              defaultValue={note.props.vibe ?? ""}
              maxLength={30}
              placeholder="chaotic"
              onBlur={(e) => {
                const value = e.target.value.trim();
                if (value !== (note.props.vibe ?? "")) void onProps({ vibe: value });
              }}
            />
          </label>
          {/* the day reads as words; the browser's date field lies over the chip, invisible, so
              a tap opens its picker and the keyboard can still type a date */}
          <label className="chip-field chip-field--date">
            <span className="chip-field__key">{t("note.chip.when")}</span>
            <span className="chip-field__day" data-empty={!when || undefined} aria-hidden="true">
              {when ? dayLabel(when, new Date()) : t("note.chip.when.pick")}
            </span>
            <input
              className="chip-field__date"
              type="date"
              value={when}
              onClick={(e) => {
                try {
                  e.currentTarget.showPicker();
                } catch {
                  // not supported, or not allowed right now: the field still takes typing
                }
              }}
              onChange={(e) => {
                setWhen(e.target.value);
                void onProps({ when: e.target.value });
              }}
            />
          </label>
        </>
      ) : (
        <>
          {note.props.vibe && (
            <PropertyChip label={t("note.chip.vibe")}>{note.props.vibe}</PropertyChip>
          )}
          {note.props.when && (
            <PropertyChip label={t("note.chip.when")}>
              {dayLabel(note.props.when, new Date())}
            </PropertyChip>
          )}
        </>
      )}

      {tags.map((tag) => (
        <span key={tag.id} className="tag-with-remove">
          <TagChip color={tag.color}>#{tag.name}</TagChip>
          {editable && (
            <button
              type="button"
              className="tag-with-remove__x"
              aria-label={t("note.tag.remove", { name: tag.name })}
              onClick={() => void removeTag(tag)}
            >
              <X size={14} strokeWidth={3} aria-hidden="true" />
            </button>
          )}
        </span>
      ))}

      {editable &&
        (adding ? (
          <form
            className="chip-field"
            onSubmit={(e) => {
              e.preventDefault();
              void submitDraft();
            }}
          >
            <input
              ref={inputRef}
              list={listId}
              className="chip-field__input"
              value={draft}
              maxLength={40}
              aria-label={t("note.tag.placeholder")}
              placeholder={t("note.tag.placeholder")}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void submitDraft()}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
            />
            <datalist id={listId}>
              {known
                .filter((k) => !tags.some((tag) => tag.id === k.id))
                .map((k) => (
                  <option key={k.id} value={k.name} />
                ))}
            </datalist>
          </form>
        ) : (
          <button type="button" className="chip-add" onClick={() => setAdding(true)}>
            <Plus size={16} strokeWidth={3} aria-hidden="true" />
            {t("note.tag.add")}
          </button>
        ))}
    </div>
  );
}
