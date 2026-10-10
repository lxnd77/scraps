"use client";

import { ACCENTS, Sticker, STICKER_IDS, type Accent } from "@scraps/ui";
import type { Editor } from "@scraps/editor/react";
import type { CoverAccent } from "@scraps/db";
import { useT } from "@/copy/useT";
import { relativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";

export const STICKER_DRAG_TYPE = "application/x-scraps-sticker";

interface Props {
  editor: Editor | null;
  accent: CoverAccent;
  editable: boolean;
  wordCount: number;
  updatedAt: string;
  people: number;
  onAccent: (accent: CoverAccent) => void;
}

/** Right rail (SPEC 6.3): sticker drawer, page outfit and the activity box. */
export function NoteRail({
  editor,
  accent,
  editable,
  wordCount,
  updatedAt,
  people,
  onAccent,
}: Props) {
  const t = useT();
  const now = useNow();

  function insert(id: string) {
    if (!editor || !editable) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "sticker", attrs: { id, size: 64 } })
      .run();
  }

  return (
    <aside className="note-rail" aria-label={t("rail.label")}>
      {editable && (
        <section className="rail-box">
          <h2 className="sc-label">{t("rail.stickers")}</h2>
          <ul className="rail-stickers">
            {STICKER_IDS.slice(0, 6).map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="rail-stickers__btn"
                  aria-label={t("rail.sticker_insert", { name: id })}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(STICKER_DRAG_TYPE, id);
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() => insert(id)}
                >
                  <Sticker id={id} size={44} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editable && (
        <section className="rail-box">
          <h2 className="sc-label">{t("rail.outfit")}</h2>
          <div className="picker__row" role="radiogroup" aria-label={t("rail.outfit")}>
            {ACCENTS.map((c: Accent) => (
              <label key={c} className="picker__option">
                <input
                  type="radio"
                  name="page-accent"
                  className="picker__input"
                  checked={accent === c}
                  onChange={() => onAccent(c)}
                />
                <span className={`picker__swatch sc-fill-${c}`} />
                <span className="sr-only">{c}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <section className="rail-box rail-box--dashed">
        <h2 className="sc-label">{t("rail.activity")}</h2>
        <p className="sc-mono">{t("note.words", { n: wordCount })}</p>
        <p className="sc-mono">{t("rail.people", { n: Math.max(1, people) })}</p>
        <p className="sc-mono">
          {now ? t("rail.edited", { when: relativeTime(updatedAt, now) }) : ""}
        </p>
      </section>
    </aside>
  );
}
