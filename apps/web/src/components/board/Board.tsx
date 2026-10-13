"use client";

import type { BoardPos, NoteKind, NoteSummary, NotesPage } from "@scraps/db";
import { FilterChip, NoteCard, Skeleton, Sticker } from "@scraps/ui";
import { Button } from "@scraps/ui";
import { FileText, Link2, ListChecks, Mic, Image as ImageIcon, Quote, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { NoteMenu, type NoteColor } from "@/components/note/NoteMenu";
import { useAi } from "@/components/ai/AiProvider";
import { useCapture } from "@/components/capture/CaptureProvider";
import { useShell } from "@/components/shell/ShellContext";
import { cheerKey, type CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import type { BoardLayout } from "@/lib/layout";
import { freshNoteIds } from "@/lib/optimistic";
import { relativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";
import { useTheme } from "@/theme/ThemeProvider";
import { Canvas } from "./canvas/Canvas";
import { LinkMedia, PicMedia, VoiceMedia } from "./CardMedia";
import { useBoardNotes, useCanvasNotes, useCardActions, useKindCounts } from "./useBoard";
import { useBoardRealtime } from "./useBoardRealtime";

const FILTERS: Array<{ kind: NoteKind | null; key: CopyKey }> = [
  { kind: null, key: "filter.all" },
  { kind: "text", key: "filter.text" },
  { kind: "list", key: "filter.list" },
  { kind: "pic", key: "filter.pic" },
  { kind: "link", key: "filter.link" },
  { kind: "voice", key: "filter.voice" },
];

const KIND_ICON = {
  text: FileText,
  list: ListChecks,
  pic: ImageIcon,
  link: Link2,
  voice: Mic,
  quote: Quote,
} as const;

interface BoardProps {
  spaceId: string;
  initialNotes: NoteSummary[];
  initialPage: NotesPage;
  initialCounts: Record<NoteKind, number>;
  layout: BoardLayout;
}

/**
 * Filter chips and the scraps of one space: an infinite canvas of cards (the "cards" layout) or
 * the compact list, plus the card actions.
 */
export function Board({ spaceId, initialNotes, initialPage, initialCounts, layout }: BoardProps) {
  const t = useT();
  const now = useNow();
  const { resolved } = useTheme();
  const { spaces, profile } = useShell();
  const { openCapture } = useCapture();
  const ai = useAi();
  const night = resolved === "midnight";
  const [kind, setKind] = useState<NoteKind | null>(null);
  const [message, setMessage] = useState<CopyKey | null>(null);
  const [menuFor, setMenuFor] = useState<NoteSummary | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  useBoardRealtime(spaceId);
  const canvasMode = layout === "cards";
  // the paged list only runs for the list layout; the canvas loads every card at once
  const query = useBoardNotes(spaceId, canvasMode ? null : kind, initialPage);
  const canvasQuery = useCanvasNotes(spaceId, initialNotes);
  const counts = useKindCounts(spaceId, initialCounts).data;
  const { update, toggleItem, placeMany } = useCardActions(
    spaceId,
    useCallback(
      (which) =>
        setMessage(
          which === "toggle"
            ? "card.error.toggle"
            : which === "offline"
              ? "card.error.offline"
              : "card.error.action",
        ),
      [],
    ),
  );

  const listNotes = useMemo(() => query.data?.pages.flatMap((p) => p.notes) ?? [], [query.data]);
  const canvasNotes = useMemo(() => canvasQuery.data ?? [], [canvasQuery.data]);
  const notes = canvasMode ? canvasNotes : listNotes;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const space = spaces.find((s) => s.id === spaceId);
  const canEdit = space?.role !== "viewer";

  // load the next page when the sentinel scrolls into view (list layout)
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage || canvasMode) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, canvasMode]);

  function metaFor(note: NoteSummary): string {
    const words = t("note.words", { n: note.wordCount });
    return now ? `${relativeTime(note.updatedAt, now)} · ${words}` : words;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const link = target.closest<HTMLElement>(".sc-notecard__link, .note-row");
    if (!link || event.altKey) return;
    const links = Array.from(
      boardRef.current?.querySelectorAll<HTMLElement>(
        ".sc-notecard__title .sc-notecard__link, .sc-notecard__quote .sc-notecard__link, .note-row",
      ) ?? [],
    );
    const index = links.indexOf(link);
    const go = (to: number) => {
      event.preventDefault();
      links[Math.max(0, Math.min(links.length - 1, to))]?.focus();
    };
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        return go(index + 1);
      case "ArrowLeft":
      case "ArrowUp":
        return go(index - 1);
      case "Home":
        return go(0);
      case "End":
        return go(links.length - 1);
      case ".": {
        if (event.metaKey || event.ctrlKey) return;
        const id = link.closest<HTMLElement>("[data-note-id]")?.dataset.noteId;
        const note = notes.find((n) => n.id === id);
        if (note && canEdit) {
          event.preventDefault();
          openMenu(note);
        }
        return;
      }
      case "p":
      case "P": {
        if (event.metaKey || event.ctrlKey || !canEdit) return;
        const id = link.closest<HTMLElement>("[data-note-id]")?.dataset.noteId;
        const note = notes.find((n) => n.id === id);
        if (note) {
          event.preventDefault();
          void update(note, { pinned: !note.pinned });
        }
      }
    }
  }

  function openMenu(note: NoteSummary) {
    if (canEdit) setMenuFor(note);
  }

  const place = useCallback(
    (note: NoteSummary, pos: BoardPos, freeze: Array<{ id: string } & BoardPos>) => {
      // the first drag on a flowing board pins every other card where it is, in one call
      if (freeze.length > 0) void placeMany([...freeze, { id: note.id, ...pos }]);
      else void update(note, { board_pos: pos });
    },
    [placeMany, update],
  );

  const moveTargets = spaces
    .filter((s) => s.id !== spaceId && s.role !== "viewer")
    .map((s) => ({ id: s.id, name: s.name }));

  const cardLabels = {
    more: "",
    pinned: t("card.pinned"),
    forever: t("card.forever"),
    progress: t("card.progress"),
    item: (text: string, done: boolean) => t(done ? "card.item.done" : "card.item.todo", { text }),
    kind: "",
  };

  function card(note: NoteSummary) {
    const pop = freshNoteIds.delete(note.id);
    const label = spaces.find((s) => s.id === note.spaceId)?.name;
    const checklist = note.preview.checklist;
    return (
      // right click is a shortcut for the card's own "more" button
      <div
        className="board__item"
        onContextMenu={(event) => {
          // a long press on a phone drags the card instead (see Canvas)
          const pointer = (event.nativeEvent as PointerEvent).pointerType;
          if (!canEdit || pointer === "touch" || pointer === "pen") return;
          event.preventDefault();
          openMenu(note);
        }}
      >
        <NoteCard
          note={note}
          href={`/n/${note.id}`}
          LinkComponent={Link}
          tidy={profile.tidyMode}
          meta={metaFor(note)}
          label={label}
          untitled={t("note.untitled")}
          className={pop ? "sc-notecard--pop" : undefined}
          cheer={checklist ? t(cheerKey(checklist.done, checklist.total)) : undefined}
          media={
            note.kind === "pic" ? (
              <PicMedia note={note} />
            ) : note.kind === "link" ? (
              <LinkMedia note={note} />
            ) : note.kind === "voice" ? (
              <VoiceMedia note={note} />
            ) : undefined
          }
          extra={
            note.kind === "pic" && (note.preview.imageCount ?? 0) > 1
              ? t("card.more_pics", { n: (note.preview.imageCount ?? 1) - 1 })
              : undefined
          }
          labels={{
            ...cardLabels,
            more: t("card.more", { title: note.title || t("note.untitled") }),
            kind: t(`card.kind.${note.kind}` as CopyKey),
          }}
          onToggleItem={
            canEdit ? (index, checked) => void toggleItem(note, index, checked) : undefined
          }
          onMenu={canEdit ? () => openMenu(note) : undefined}
        />
      </div>
    );
  }

  const loading = canvasMode
    ? canvasQuery.isPending
    : query.isPending || (query.isPlaceholderData && listNotes.length === 0 && query.isFetching);
  const matching = kind === null ? notes : notes.filter((n) => n.kind === kind);

  return (
    <>
      <div role="group" aria-label={t("filter.label")} className="board__filters">
        {FILTERS.map(({ kind: k, key }) => (
          <FilterChip
            key={key}
            pressed={kind === k}
            count={k === null ? total : counts[k]}
            accent={night ? "lilac" : "pink"}
            onClick={() => setKind(k)}
          >
            {t(key)}
          </FilterChip>
        ))}
      </div>

      {message && (
        <p role="alert" className="field-error">
          {t(message)}
        </p>
      )}

      {(canvasMode ? canvasQuery.isError : query.isError) && notes.length === 0 ? (
        <div role="alert" className="board__callout">
          <p>{t("board.error")}</p>
          <Button
            variant="ghost"
            onClick={() => void (canvasMode ? canvasQuery.refetch() : query.refetch())}
          >
            {t("action.retry")}
          </Button>
        </div>
      ) : loading ? (
        <div aria-busy="true" aria-label={t("board.loading")} className="board__grid">
          {[190, 140, 230, 160, 200, 150].map((h, i) => (
            <Skeleton key={i} height={h} className="board__skeleton" />
          ))}
        </div>
      ) : notes.length === 0 || (!canvasMode && matching.length === 0) ? (
        <section className="board__empty" aria-label={space?.name}>
          <Sticker id={night ? "sleepy-moon" : "sparkle"} size={96} />
          <p className="board__empty-copy">
            {kind === null ? t("empty.board") : t("board.filter_empty")}
          </p>
          {kind === null && canEdit && (
            <Button color={night ? "pink" : "yellow"} onClick={() => openCapture({ spaceId })}>
              <Plus size={20} strokeWidth={3} aria-hidden="true" />
              {t("action.new_scrap")}
            </Button>
          )}
        </section>
      ) : canvasMode ? (
        // roving focus: key presses bubble up from the focusable card links inside
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div ref={boardRef} className="board__canvas" onKeyDown={onKeyDown}>
          {kind !== null && matching.length === 0 && (
            <p role="status" className="board__filter-note">
              {t("board.filter_empty")}
            </p>
          )}
          <Canvas
            spaceId={spaceId}
            notes={notes}
            canEdit={canEdit}
            dimmed={(note) => kind !== null && note.kind !== kind}
            renderCard={card}
            onPlace={place}
            label={t("note.list.title")}
          />
        </div>
      ) : (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions
        <div ref={boardRef} onKeyDown={onKeyDown}>
          <ul className="board__rows" aria-label={t("note.list.title")}>
            {matching.map((note) => {
              const Icon = KIND_ICON[note.kind];
              const label = spaces.find((s) => s.id === note.spaceId)?.name;
              return (
                <li key={note.id} data-note-id={note.id}>
                  <Link href={`/n/${note.id}`} className="note-row">
                    <span className={`note-row__dot sc-fill-${note.color}`} aria-hidden="true">
                      <Icon size={16} strokeWidth={2.6} />
                    </span>
                    <span className="note-row__text">
                      <span className="note-row__title">{note.title || t("note.untitled")}</span>
                      {label && <span className="note-row__preview">{label}</span>}
                    </span>
                    <span className="sc-mono note-row__meta">{metaFor(note)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!canvasMode && hasNextPage && (
        <div ref={sentinel} className="board__more">
          <Button
            variant="ghost"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {t("board.more")}
          </Button>
        </div>
      )}

      {menuFor && (
        <NoteMenu
          open
          onClose={() => setMenuFor(null)}
          color={menuFor.color}
          pinned={menuFor.pinned}
          onColor={(color: NoteColor) => {
            const note = menuFor;
            setMenuFor({ ...note, color });
            void update(note, { color });
          }}
          onPin={(pinned) => {
            const note = menuFor;
            setMenuFor({ ...note, pinned });
            void update(note, { pinned });
          }}
          onDelete={() => void update(menuFor, { deleted_at: new Date().toISOString() })}
          moveTargets={moveTargets}
          onMove={(target) => void update(menuFor, { space_id: target, board_pos: null })}
          onSuggest={() => ai.suggest(menuFor.id, menuFor.spaceId)}
        />
      )}
    </>
  );
}
