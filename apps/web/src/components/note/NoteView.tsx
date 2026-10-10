"use client";

import type { NoteDetail, NoteTag, SpaceSummary } from "@scraps/db";
import type { CoverAccent, NoteCover } from "@scraps/db";
import { ScrapsEditor, type Editor } from "@scraps/editor/react";
import { Sticker, Toast } from "@scraps/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useT } from "@/copy/useT";
import { queue } from "@/lib/offline/runtime";
import { ShareDialog } from "@/components/share/ShareDialog";
import { NoteCoverHeader } from "./NoteCoverHeader";
import { NoteMenu, type NoteColor } from "./NoteMenu";
import { NoteRail } from "./NoteRail";
import { NoteTopBar } from "./NoteTopBar";
import { PropertyChips } from "./PropertyChips";
import { useLiveTitle } from "./useLiveTitle";
import { useMediaApi } from "./useMediaApi";
import { useSyncStatus } from "@/lib/offline/syncStore";
import { usePresence } from "./usePresence";
import { useMembersInfo } from "./useMembersInfo";
import { avatarColorFor } from "@/lib/presence";
import { useNoteSession } from "./useNoteSession";

interface Props {
  note: NoteDetail;
  space: Pick<SpaceSummary, "id" | "name" | "color" | "role">;
  spaceTags: NoteTag[];
  viewer: { id: string; name: string; sticker: string };
}

export function NoteView({ note, space, spaceTags, viewer }: Props) {
  const t = useT();
  const router = useRouter();
  const session = useNoteSession(note.id);
  const media = useMediaApi({ noteId: note.id, spaceId: space.id, user: viewer });
  const people = usePresence(session.provider, viewer.id);
  const sync = useSyncStatus();
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 3000);
    return () => window.clearTimeout(id);
  }, []);
  const members = useMembersInfo(space.id);
  const title = useLiveTitle(session.ydoc, note.title);
  const [color, setColor] = useState(note.color);
  const [pinned, setPinned] = useState(note.pinned);
  const [menu, setMenu] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState(false);
  const [props, setProps] = useState(note.props);
  const [cover, setCover] = useState<NoteCover | null>(note.cover);
  const [icon, setIcon] = useState<string | null>(note.iconSticker);
  const [editor, setEditor] = useState<Editor | null>(null);
  const accent: CoverAccent = props.accent ?? "yellow";
  const editable = space.role !== "viewer" && !session.demoted;

  useEffect(() => {
    document.title = `${title.trim() || t("note.untitled")} · scraps.`;
  }, [title, t]);

  /** Metadata goes through PostgREST under RLS, stamped with the client clock for last-write-wins. */
  async function writeMeta(patch: Record<string, unknown>): Promise<boolean> {
    try {
      // stored locally and sent when there is a connection; replays are last-write-wins per field
      await queue({
        type: "patchNote",
        noteId: note.id,
        fields: { ...patch, meta_updated_at: new Date().toISOString() },
      });
      return true;
    } catch {
      setError(true);
      return false;
    }
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

  async function changeCover(next: NoteCover | null) {
    const previous = cover;
    setCover(next);
    if (!(await writeMeta({ cover: next }))) setCover(previous);
  }

  async function changeIcon(next: string | null) {
    const previous = icon;
    setIcon(next);
    if (!(await writeMeta({ icon_sticker: next }))) setIcon(previous);
  }

  async function changeProps(patch: { vibe?: string; when?: string; accent?: CoverAccent }) {
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
        <h1 className="notfound__title">
          {session.revoked ? t("note.revoked.title") : t("note.denied.title")}
        </h1>
        {session.revoked && <p className="field-hint">{t("note.revoked.body")}</p>}
        <a href="/" className="sc-btn sc-btn--dark">
          {t("error.back_to_board")}
        </a>
      </section>
    );
  }

  // the app-wide status (outbox, browser, this note's socket); a note that has not connected yet
  // is not "saved" yet
  const syncState = !session.connected && sync.kind === "saved" ? "offline" : sync.kind;

  return (
    <div className="note-page" style={{ ["--page-accent" as string]: `var(--c-${accent})` }}>
      <NoteTopBar
        space={space}
        title={title}
        syncState={syncState}
        viewOnly={!editable}
        onMore={() => setMenu(true)}
        onShare={() => setSharing(true)}
        people={people}
      />

      <main id="main" className="note-page__main">
        <div className="note-page__layout">
          <div className="note-page__column">
            <NoteCoverHeader
              cover={cover}
              iconSticker={icon}
              accent={accent}
              editable={editable}
              media={media}
              onCover={(c) => void changeCover(c)}
              onIcon={(i) => void changeIcon(i)}
            />
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
            {session.synced || session.localReady ? (
              <ScrapsEditor
                ydoc={session.ydoc}
                editable={editable}
                showToolbar
                media={media}
                onReady={setEditor}
                members={members}
                collab={
                  session.provider
                    ? {
                        provider: session.provider,
                        user: {
                          userId: viewer.id,
                          name: viewer.name || t("share.you"),
                          sticker: viewer.sticker,
                          accent: avatarColorFor(viewer.id),
                        },
                      }
                    : undefined
                }
                placeholder={{ title: t("note.untitled"), block: t("note.placeholder.block") }}
              />
            ) : (
              <div className="scrap-editor-shell">
                <div className="scrap-editor scrap-editor--loading" aria-busy="true" />
                {waited && !session.connected && (
                  <p role="status" className="field-hint">
                    {t("note.offline.unavailable")}
                  </p>
                )}
              </div>
            )}
          </div>
          <NoteRail
            editor={editor}
            accent={accent}
            editable={editable}
            wordCount={note.wordCount}
            updatedAt={note.updatedAt}
            people={people.length}
            names={people.map((p) => p.name)}
            onAccent={(c) => void changeProps({ accent: c })}
          />
        </div>
      </main>

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        space={{ id: space.id, name: space.name, role: space.role }}
      />

      <NoteMenu
        open={menu}
        onClose={() => setMenu(false)}
        color={color}
        pinned={pinned}
        onColor={(c) => void changeColor(c)}
        onPin={(p) => void changePinned(p)}
        onDelete={() => void remove()}
        onShare={() => setSharing(true)}
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
