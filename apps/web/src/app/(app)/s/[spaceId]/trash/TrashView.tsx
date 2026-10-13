"use client";

import { TRASH_DAYS, type TrashedNote } from "@scraps/db";
import { Button, Dialog, Sticker } from "@scraps/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeading } from "@/components/shell/PageHeading";
import { useT } from "@/copy/useT";
import { queue } from "@/lib/offline/runtime";
import { createClient } from "@/lib/supabase/client";

interface Props {
  space: { id: string; name: string; role: "owner" | "editor" | "viewer" };
  initialNotes: TrashedNote[];
}

const DAY_MS = 24 * 3600_000;

function daysLeft(deletedAt: string, now: number): number {
  const due = new Date(deletedAt).getTime() + TRASH_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((due - now) / DAY_MS));
}

/** Per-space trash (SPEC 6.10): restore for editors and owners, delete forever for the owner. */
export function TrashView({ space, initialNotes }: Props) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(initialNotes);
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // a stable "now" for the days-left labels; the list is not live
  const [now] = useState(() => Date.now());
  const canRestore = space.role !== "viewer";
  const isOwner = space.role === "owner";

  async function restore(note: TrashedNote) {
    setFailed(false);
    setNotes((list) => list.filter((n) => n.id !== note.id));
    try {
      await queue({
        type: "patchNote",
        noteId: note.id,
        fields: { deleted_at: null, meta_updated_at: new Date().toISOString() },
      });
      void queryClient.invalidateQueries({ queryKey: ["board", space.id] });
      void queryClient.invalidateQueries({ queryKey: ["kinds", space.id] });
      router.refresh();
    } catch {
      setNotes((list) => [note, ...list]);
      setFailed(true);
    }
  }

  async function deleteForever(ids: string[]) {
    setBusy(true);
    setFailed(false);
    const body =
      ids.length === notes.length && ids.length > 1 ? { emptySpaceId: space.id } : { noteIds: ids };
    const { error } = await createClient().functions.invoke("purge-trash", { body });
    setBusy(false);
    setConfirm(null);
    if (error) {
      setFailed(true);
      return;
    }
    setNotes((list) => list.filter((n) => !ids.includes(n.id)));
    router.refresh();
  }

  return (
    <section className="page trash">
      {/* the way back reads like the board's kicker: the space this trash belongs to */}
      <Link
        href={`/s/${space.id}`}
        className="page-back sc-label"
        aria-label={t("trash.back", { space: space.name })}
      >
        <ChevronLeft size={16} strokeWidth={2.8} aria-hidden="true" />
        {space.name}
      </Link>
      <PageHeading title={t("trash.title")} />
      <p className="field-hint">{t("trash.hint", { days: TRASH_DAYS })}</p>

      {failed && (
        <p role="alert" className="field-error">
          {t("trash.error")}
        </p>
      )}

      {notes.length === 0 ? (
        <div className="trash__empty">
          <Sticker id="sleepy-moon" size={96} />
          <p>{t("trash.empty")}</p>
        </div>
      ) : (
        <>
          <ul className="trash__list" aria-label={t("trash.title")}>
            {notes.map((note) => (
              <li
                key={note.id}
                className={`trash__row sc-fill-${note.color}`}
                data-note-id={note.id}
              >
                <div className="trash__text">
                  <h2 className="trash__name">{note.title || t("note.untitled")}</h2>
                  <p className="sc-mono trash__meta">
                    {t("trash.days_left", { n: daysLeft(note.deletedAt, now) })}
                  </p>
                </div>
                <div className="trash__actions">
                  {canRestore && (
                    <Button variant="ghost" onClick={() => void restore(note)}>
                      <RotateCcw size={18} strokeWidth={2.6} aria-hidden="true" />
                      {t("trash.restore")}
                    </Button>
                  )}
                  {isOwner && (
                    <Button variant="ghost" onClick={() => setConfirm({ ids: [note.id] })}>
                      <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
                      {t("trash.delete")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {/* the one thing here that can't be undone comes last, after what it would delete */}
          {isOwner && (
            <div className="trash__bulk">
              <Button variant="ghost" onClick={() => setConfirm({ ids: notes.map((n) => n.id) })}>
                <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
                {t("trash.empty_all")}
              </Button>
            </div>
          )}
          {!isOwner && <p className="field-hint">{t("trash.owner_only")}</p>}
        </>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={t("trash.confirm.title")}
      >
        <div className="note-menu">
          <p className="field-hint">
            {confirm && confirm.ids.length > 1
              ? t("trash.confirm.many", { n: confirm.ids.length })
              : t("trash.confirm.body")}
          </p>
          <div className="space-form__actions">
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {t("space.cancel")}
            </Button>
            <Button
              variant="dark"
              disabled={busy}
              onClick={() => confirm && void deleteForever(confirm.ids)}
            >
              <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
              {t("trash.confirm.yes")}
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
