"use client";

import { ACCENTS, type Accent } from "@scraps/ui";
import type { CoverAccent } from "@scraps/db";
import { useT } from "@/copy/useT";
import { relativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";

interface Props {
  accent: CoverAccent;
  editable: boolean;
  wordCount: number;
  updatedAt: string;
  people: number;
  names?: string[];
  onAccent: (accent: CoverAccent) => void;
}

/**
 * Right rail (SPEC 6.3): page outfit and the activity box. Stickers are added from the editor
 * (the floating toolbar, /sticker or ":"), so they always float over the scrap.
 */
export function NoteRail({
  accent,
  editable,
  wordCount,
  updatedAt,
  people,
  names = [],
  onAccent,
}: Props) {
  const t = useT();
  const now = useNow();

  return (
    <aside className="note-rail" aria-label={t("rail.label")}>
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
        {names.length > 0 && <p className="sc-mono">{names.join(", ")}</p>}
        <p className="sc-mono">
          {now ? t("rail.edited", { when: relativeTime(updatedAt, now) }) : ""}
        </p>
      </section>
    </aside>
  );
}
