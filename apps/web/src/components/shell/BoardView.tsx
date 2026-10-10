"use client";

import type { NoteSummary } from "@scraps/db";
import { Button, Highlight, Sparkle, Sticker } from "@scraps/ui";
import { LayoutGrid, Pencil, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { boardGreetingKey, splitHighlight } from "@/copy/en";
import { useT } from "@/copy/useT";
import { useCreateNote } from "@/lib/useCreateNote";
import { useNow } from "@/lib/useNow";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";
import { useTheme } from "@/theme/ThemeProvider";
import { NotesList } from "./NotesList";
import { useShell } from "./ShellContext";
import { SpaceDialog } from "./SpaceDialog";

function kickerParts(now: Date | null) {
  if (!now) return { weekday: "", time: "" };
  return {
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase(),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase(),
  };
}

/**
 * Board for a space: greeting header with the desktop actions, then the scraps.
 * Phase 2 shows a plain list and "new scrap" starts a blank note; Phase 3 brings the card board
 * and the quick capture sheet.
 */
export function BoardView({ spaceId, notes }: { spaceId: string; notes: NoteSummary[] }) {
  const t = useT();
  const now = useNow();
  const { resolved } = useTheme();
  const { spaces } = useShell();
  const space = spaces.find((s) => s.id === spaceId);
  const [editing, setEditing] = useState(false);
  const { create, pending, failed } = useCreateNote(spaceId);
  const night = resolved === "midnight";

  const hour = now?.getHours() ?? 9;
  const greeting = t(night ? "board.greeting" : boardGreetingKey(hour));
  const { weekday, time } = kickerParts(now);
  const kicker = now
    ? t("board.kicker", { weekday, time, space: space?.name ?? "" })
    : (space?.name ?? "");

  return (
    <div className="board">
      <header className="board__header">
        <Sparkle className="board__star board__star--a" size={22} color="yellow" />
        <Sparkle className="board__star board__star--b" size={14} color="ink" />
        <Sparkle className="board__star board__star--c" size={18} color="pink" />

        <div className="board__heading">
          <div className="board__kickerrow">
            <p className="sc-label board__kicker">{kicker}</p>
            {space?.role === "owner" && (
              <Button
                variant="icon"
                size="sm"
                aria-label={t("spaces.edit")}
                onClick={() => setEditing(true)}
              >
                <Pencil size={18} strokeWidth={2.4} aria-hidden="true" />
              </Button>
            )}
          </div>
          <h1 className="board__title">
            {splitHighlight(greeting).map((part, index) => (
              <Fragment key={index}>
                {part.highlight ? (
                  <Highlight color={night ? "pink" : "yellow"}>{part.text}</Highlight>
                ) : (
                  part.text
                )}
              </Fragment>
            ))}
          </h1>
        </div>

        <div className="board__actions">
          <span className="board__toggle">
            <HeaderThemeToggle size="lg" />
          </span>
          <Button
            variant="icon"
            aria-label={t("action.switch_layout")}
            aria-disabled="true"
            title={t("coming.soon")}
          >
            <LayoutGrid size={22} strokeWidth={2.3} aria-hidden="true" />
          </Button>
          <Button
            color={night ? "pink" : "yellow"}
            disabled={pending}
            onClick={() => void create()}
            className="board__new"
          >
            <Plus size={20} strokeWidth={3} aria-hidden="true" />
            {t("action.new_scrap")}
          </Button>
        </div>
      </header>

      {failed && (
        <p role="alert" className="field-error">
          {t("note.error.create")}
        </p>
      )}

      {notes.length > 0 ? (
        <NotesList notes={notes} />
      ) : (
        <section className="board__empty" aria-label={space?.name}>
          <Sticker id={night ? "sleepy-moon" : "sparkle"} size={96} />
          <p className="board__empty-copy">{t("empty.board")}</p>
          <Button
            color={night ? "pink" : "yellow"}
            disabled={pending}
            onClick={() => void create()}
          >
            <Plus size={20} strokeWidth={3} aria-hidden="true" />
            {t("action.new_scrap")}
          </Button>
        </section>
      )}

      {space && <SpaceDialog open={editing} onClose={() => setEditing(false)} space={space} />}
    </div>
  );
}
