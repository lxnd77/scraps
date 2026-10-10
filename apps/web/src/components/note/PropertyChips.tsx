"use client";

import type { NoteDetail, NoteTag } from "@scraps/db";
import { PropertyChip, TagChip } from "@scraps/ui";
import { Plus, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/copy/useT";
import { createClient } from "@/lib/supabase/client";

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
  const inputRef = useRef<HTMLInputElement>(null);

  // move focus into the new-tag field when it opens
  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  async function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, "").slice(0, 40);
    if (!name) return;
    if (tags.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) return;

    const supabase = createClient();
    let tag = known.find((k) => k.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      const { data, error } = await supabase
        .from("tags")
        .insert({ space_id: note.spaceId, name })
        .select("id, name, color")
        .single();
      if (error || !data) return onError();
      tag = { id: data.id, name: data.name, color: data.color as NoteTag["color"] };
      setKnown((list) => [...list, tag!]);
    }
    const { error } = await supabase.from("note_tags").insert({ note_id: note.id, tag_id: tag.id });
    if (error) return onError();
    setTags((list) => [...list, tag!]);
  }

  async function removeTag(tag: NoteTag) {
    const supabase = createClient();
    const { error } = await supabase
      .from("note_tags")
      .delete()
      .eq("note_id", note.id)
      .eq("tag_id", tag.id);
    if (error) return onError();
    setTags((list) => list.filter((x) => x.id !== tag.id));
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
          <label className="chip-field">
            <span className="chip-field__key">{t("note.chip.when")}</span>
            <input
              className="chip-field__input"
              type="date"
              defaultValue={note.props.when ?? ""}
              onChange={(e) => void onProps({ when: e.target.value })}
            />
          </label>
        </>
      ) : (
        <>
          {note.props.vibe && (
            <PropertyChip label={t("note.chip.vibe")}>{note.props.vibe}</PropertyChip>
          )}
          {note.props.when && (
            <PropertyChip label={t("note.chip.when")}>{note.props.when}</PropertyChip>
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
