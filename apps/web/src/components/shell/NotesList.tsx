"use client";

import type { NoteSummary } from "@scraps/db";
import { Pin } from "lucide-react";
import Link from "next/link";
import { useT } from "@/copy/useT";
import { relativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";

/**
 * Temporary board content: a plain list so scraps can be created and reopened.
 * Phase 3 replaces it with the real card board.
 */
export function NotesList({ notes }: { notes: NoteSummary[] }) {
  const t = useT();
  const now = useNow();

  return (
    <section aria-label={t("note.list.title")}>
      <ul className="notes-list">
        {notes.map((note) => (
          <li key={note.id}>
            <Link href={`/n/${note.id}`} className="note-row">
              <span className={`note-row__dot sc-fill-${note.color}`} aria-hidden="true" />
              <span className="note-row__text">
                <span className="note-row__title">
                  {note.pinned && <Pin size={14} strokeWidth={3} aria-label="pinned" />}
                  {note.title || t("note.untitled")}
                </span>
                {note.previewText && <span className="note-row__preview">{note.previewText}</span>}
              </span>
              <span className="sc-mono note-row__meta">
                {t("note.words", { n: note.wordCount })}
                {now ? ` · ${relativeTime(note.updatedAt, now)}` : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
