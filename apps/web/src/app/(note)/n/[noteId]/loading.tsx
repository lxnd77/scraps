"use client";

import { Skeleton } from "@scraps/ui";
import { useT } from "@/copy/useT";

/** Shown the moment a scrap is clicked, while the server checks it and loads its details. */
export default function NoteLoading() {
  const t = useT();
  return (
    <div className="note-page">
      <main id="main" className="note-page__main" aria-busy="true" aria-label={t("note.loading")}>
        <div className="note-loading">
          <Skeleton height={56} className="note-loading__title" />
          {[24, 24, 24, 24, 24, 24].map((h, i) => (
            <Skeleton key={i} height={h} className="note-loading__line" />
          ))}
        </div>
      </main>
    </div>
  );
}
