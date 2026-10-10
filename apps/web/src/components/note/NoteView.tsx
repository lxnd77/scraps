"use client";

import type { NoteDetail, NoteTag, SpaceSummary } from "@scraps/db";
import { ScrapsEditor } from "@scraps/editor/react";
import { Sticker, Toast } from "@scraps/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/copy/useT";
import { createClient } from "@/lib/supabase/client";
import { NoteMenu, type NoteColor } from "./NoteMenu";
import { NoteTopBar } from "./NoteTopBar";
import { PropertyChips } from "./PropertyChips";
import { useLiveTitle } from "./useLiveTitle";
import { useNoteSession } from "./useNoteSession";

interface Props {
  note: NoteDetail;
  space: Pick<SpaceSummary, "id" | "name" | "color" | "role">;
  spaceTags: NoteTag[];
}

export function NoteView({ note, space, spaceTags }: Props) {
  const t = useT();
  const router = useRouter();
  const session = useNoteSession(note.id);
  const title = useLiveTitle(session.ydoc, note.title);
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState(false);
  const [props, setProps] = useState(note.props);
  const editable = space.role !== "viewer";

  useEffect(() => {
    document.title = `${title.trim() || t("note.untitled")} · scraps.`;
  }, [title, t]);

  /** Metadata goes through PostgREST under RLS, stamped with the client clock for last-write-wins. */
  async function writeMeta(patch: Record<string, unknown>): Promise<boolean> {
    const supabase = createClient();
    const { error: failure } = await supabase
      .from("notes")
      .update({ ...patch, meta_updated_at: new Date().toISOString() })
      .eq("id", note.id);
    if (failure) {
      setError(true);
      return false;
    }
    return true;
  }

  async function changeColor(next: NoteColor) {
    const previous = color;
    setColor(next);
    if (!(await writeMeta({ color: next }))) setColor(previous);
  }

  async function changePinned(next: boolean) {
    const previous = pinned;
    setPinned(next);
    if (!(await writeMeta({ pinned: next }))) setPinned(previous);
  }

  async function remove() {
    if (await writeMeta({ deleted_at: new Date().toISOString() })) {
      router.push(`/s/${space.id}`);
      router.refresh();
    }
  }

  async function changeProps(patch: { vibe?: string; when?: string }) {
    const merged = { ...props, ...patch };
    // empty values leave the object, so the column stays tidy
    for (const key of Object.keys(merged) as Array<keyof typeof merged>) {
      if (!merged[key]) delete merged[key];
    }
    const previous = props;
    setProps(merged);
    if (!(await writeMeta({ props: merged }))) setProps(previous);
  }

  if (session.denied) {
    return (
      <section className="notfound">
        <Sticker id="sleepy-moon" size={120} />
        <h1 className="notfound__title">{t("note.denied.title")}</h1>
        <a href="/" className="sc-btn sc-btn--dark">
          {t("error.back_to_board")}
        </a>
      </section>
    );
  }

  const syncState = !session.connected ? "offline" : session.unsynced > 0 ? "syncing" : "saved";

  return (
    <div className="note-page">
      <NoteTopBar
        space={space}
        title={title}
        syncState={syncState}
        viewOnly={!editable}
        onMore={() => setMenu(true)}
      />

      <main id="main" className="note-page__main">
        <PropertyChips
          note={{ ...note, props }}
          spaceTags={spaceTags}
          editable={editable}
          onProps={async (patch) => {
            await changeProps(patch);
          }}
          onError={() => setError(true)}
        />
        {/* The editor binds to the document once, so it must start after the first sync.
            Binding to an empty fragment makes it write a default paragraph that then merges
            with the stored one. */}
        {session.synced ? (
          <ScrapsEditor
            ydoc={session.ydoc}
            editable={editable}
            showToolbar
            placeholder={{ title: t("note.untitled"), block: t("note.placeholder.block") }}
          />
        ) : (
          <div className="scrap-editor-shell">
            <div className="scrap-editor scrap-editor--loading" aria-busy="true" />
          </div>
        )}
      </main>

      <NoteMenu
        open={menu}
        onClose={() => setMenu(false)}
        color={color}
        pinned={pinned}
        onColor={(c) => void changeColor(c)}
        onPin={(p) => void changePinned(p)}
        onDelete={() => void remove()}
      />

      {error && (
        <div className="note-toast">
          <Toast
            variant="suggestion"
            acceptLabel="ok"
            dismissLabel="close"
            onAccept={() => setError(false)}
            onDismiss={() => setError(false)}
          >
            {t("note.error.save")}
          </Toast>
        </div>
      )}
    </div>
  );
}
