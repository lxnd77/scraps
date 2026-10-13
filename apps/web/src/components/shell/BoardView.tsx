"use client";

import type { NoteKind, NotesPage, NoteSummary } from "@scraps/db";
import { Button, Highlight, Sparkle } from "@scraps/ui";
import { LayoutGrid, List, MoreHorizontal, Pencil, Plus, Search, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { Board } from "@/components/board/Board";
import { useCapture } from "@/components/capture/CaptureProvider";
import { usePalette } from "@/components/search/PaletteProvider";
import { greetingKey, splitHighlight } from "@/copy/en";
import { useT } from "@/copy/useT";
import { readLayout, writeLayout, type BoardLayout } from "@/lib/layout";
import { useNow } from "@/lib/useNow";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";
import { useTheme } from "@/theme/ThemeProvider";
import { useShell } from "./ShellContext";
import { ShareDialog } from "@/components/share/ShareDialog";
import { SpaceDialog } from "./SpaceDialog";
import { SpaceMenu } from "./SpaceMenu";

function kickerParts(now: Date | null) {
  if (!now) return { weekday: "", time: "" };
  return {
    weekday: now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase(),
    time: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase(),
  };
}

/** Board for a space: greeting header with the actions, filter chips and the scraps. */
export function BoardView({
  spaceId,
  initialNotes,
  initialPage,
  initialCounts,
}: {
  spaceId: string;
  initialNotes: NoteSummary[];
  initialPage: NotesPage;
  initialCounts: Record<NoteKind, number>;
}) {
  const t = useT();
  const now = useNow();
  const { resolved } = useTheme();
  const { spaces } = useShell();
  const { openCapture } = useCapture();
  const palette = usePalette();
  const space = spaces.find((s) => s.id === spaceId);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [layout, setLayout] = useState<BoardLayout>("cards");
  const night = resolved === "midnight";
  const canEdit = space?.role !== "viewer";

  // read the saved layout after mount so the server and first client render agree
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLayout(readLayout());
  }, []);

  function toggleLayout() {
    const next: BoardLayout = layout === "cards" ? "list" : "cards";
    setLayout(next);
    writeLayout(next);
  }

  const hour = now?.getHours() ?? 9;
  const greeting = t(greetingKey(hour, night, "board"));
  const phoneGreeting = t(greetingKey(hour, night, "phone"));
  const { weekday, time } = kickerParts(now);
  const kicker = now
    ? t("board.kicker", { weekday, time, space: space?.name ?? "" })
    : (space?.name ?? "");

  function renderGreeting(text: string) {
    return splitHighlight(text).map((part, index) => (
      <Fragment key={index}>
        {part.highlight ? (
          <Highlight color={night ? "pink" : "yellow"}>{part.text}</Highlight>
        ) : (
          part.text
        )}
      </Fragment>
    ));
  }

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
                className="board__edit"
                aria-label={t("spaces.edit")}
                onClick={() => setEditing(true)}
              >
                <Pencil size={18} strokeWidth={2.4} aria-hidden="true" />
              </Button>
            )}
          </div>
          <h1 className="board__title">
            <span className="board__title--desktop">{renderGreeting(greeting)}</span>
            <span className="board__title--phone">{renderGreeting(phoneGreeting)}</span>
          </h1>
        </div>

        <div className="board__actions">
          <span className="board__toggle">
            <HeaderThemeToggle size="lg" />
          </span>
          <Button
            variant="icon"
            aria-label={layout === "cards" ? t("board.layout.list") : t("board.layout.cards")}
            onClick={toggleLayout}
          >
            {layout === "cards" ? (
              <List size={22} strokeWidth={2.3} aria-hidden="true" />
            ) : (
              <LayoutGrid size={22} strokeWidth={2.3} aria-hidden="true" />
            )}
          </Button>
          <Button variant="icon" aria-label={t("share.open")} onClick={() => setSharing(true)}>
            <Share2 size={22} strokeWidth={2.3} aria-hidden="true" />
          </Button>
          <Link
            href={`/s/${spaceId}/trash`}
            className="sc-btn sc-btn--icon"
            aria-label={t("trash.link")}
            data-tip={t("trash.link")}
          >
            <Trash2 size={22} strokeWidth={2.3} aria-hidden="true" />
          </Link>
          {canEdit && (
            <Button
              color={night ? "pink" : "yellow"}
              onClick={() => openCapture({ spaceId })}
              className="board__new"
            >
              <Plus size={20} strokeWidth={3} aria-hidden="true" />
              {t("action.new_scrap")}
            </Button>
          )}
        </div>
      </header>

      {/* phones and tablets: search, and the header's actions behind one button */}
      <div className="board__tools">
        <button type="button" className="board__search" onClick={palette.open}>
          <Search size={20} strokeWidth={2.4} aria-hidden="true" />
          <span>{t("search.placeholder")}</span>
        </button>
        <Button
          variant="icon"
          className="board__more"
          aria-label={t("board.space_more", { space: space?.name ?? "" })}
          data-tip-align="end"
          aria-haspopup="dialog"
          onClick={() => setMenu(true)}
        >
          <MoreHorizontal size={22} strokeWidth={2.6} aria-hidden="true" />
        </Button>
      </div>

      <Board
        spaceId={spaceId}
        initialNotes={initialNotes}
        initialPage={initialPage}
        initialCounts={initialCounts}
        layout={layout}
      />

      <SpaceMenu
        open={menu}
        onClose={() => setMenu(false)}
        title={space?.name ?? t("board.this_space")}
        spaceId={spaceId}
        layout={layout}
        onToggleLayout={toggleLayout}
        onShare={() => setSharing(true)}
        onEdit={space?.role === "owner" ? () => setEditing(true) : undefined}
      />
      {space && <SpaceDialog open={editing} onClose={() => setEditing(false)} space={space} />}
      {space && (
        <ShareDialog
          open={sharing}
          onClose={() => setSharing(false)}
          space={{ id: space.id, name: space.name, role: space.role }}
        />
      )}
    </div>
  );
}
