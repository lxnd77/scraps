"use client";

import type { NoteKind, NoteSummary, NotesPage } from "@scraps/db";
import { FilterChip, NoteCard, Skeleton, Sticker } from "@scraps/ui";
import { Button } from "@scraps/ui";
import { FileText, Link2, ListChecks, Mic, Image as ImageIcon, Quote, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { NoteMenu, type NoteColor } from "@/components/note/NoteMenu";
import { useCapture } from "@/components/capture/CaptureProvider";
import { useShell } from "@/components/shell/ShellContext";
import { cheerKey, type CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";
import type { BoardLayout } from "@/lib/layout";
import { freshNoteIds } from "@/lib/optimistic";
import { relativeTime } from "@/lib/relativeTime";
import { useNow } from "@/lib/useNow";
import { useTheme } from "@/theme/ThemeProvider";
import { LinkMedia, PicMedia, VoiceMedia } from "./CardMedia";
import { useBoardNotes, useCardActions, useKindCounts } from "./useBoard";
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
  initialPage: NotesPage;
  initialCounts: Record<NoteKind, number>;
  layout: BoardLayout;
}

/** Filter chips, the card board (or compact list) and card actions for one space. */
export function Board({ spaceId, initialPage, initialCounts, layout }: BoardProps) {
  const t = useT();
  const now = useNow();
  const { resolved } = useTheme();
  const { spaces, profile } = useShell();
  const { openCapture } = useCapture();
  const night = resolved === "midnight";
  const [kind, setKind] = useState<NoteKind | null>(null);
  const [message, setMessage] = useState<CopyKey | null>(null);
  const [menuFor, setMenuFor] = useState<NoteSummary | null>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  const pressTimer = useRef<number | null>(null);

  useBoardRealtime(spaceId);
  const query = useBoardNotes(spaceId, kind, initialPage);
  const counts = useKindCounts(spaceId, initialCounts).data;
  const { update, toggleItem } = useCardActions(
    spaceId,
    useCallback(
      (which) => setMessage(which === "toggle" ? "card.error.toggle" : "card.error.action"),
      [],
    ),
  );

  const notes = useMemo(() => query.data?.pages.flatMap((p) => p.notes) ?? [], [query.data]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const space = spaces.find((s) => s.id === spaceId);
  const canEdit = space?.role !== "viewer";

  // load the next page when the sentinel scrolls into view
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  function metaFor(note: NoteSummary): string {
    const words = t("note.words", { n: note.wordCount });
    return now ? `${relativeTime(note.updatedAt, now)} · ${words}` : words;
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const target = event.target as HTMLElement;
    const link = target.closest<HTMLElement>(".sc-notecard__link, .note-row");
    if (!link) return;
    const links = Array.from(
      gridRef.current?.querySelectorAll<HTMLElement>(
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
      case "p":
      case "P": {
        if (event.metaKey || event.ctrlKey || event.altKey || !canEdit) return;
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

  const loading =
    query.isPending || (query.isPlaceholderData && notes.length === 0 && query.isFetching);

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

      {query.isError && notes.length === 0 ? (
        <div role="alert" className="board__callout">
          <p>{t("board.error")}</p>
          <Button variant="ghost" onClick={() => void query.refetch()}>
            {t("action.retry")}
          </Button>
        </div>
      ) : loading ? (
        <div aria-busy="true" aria-label={t("board.loading")} className="board__grid">
          {[190, 140, 230, 160, 200, 150].map((h, i) => (
            <Skeleton key={i} height={h} className="board__skeleton" />
          ))}
        </div>
      ) : notes.length === 0 ? (
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
      ) : (
        // roving focus: key presses bubble up from the focusable card links inside
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
        <ul
          ref={gridRef}
          className={layout === "list" ? "board__rows" : "board__grid"}
          aria-label={t("note.list.title")}
          onKeyDown={onKeyDown}
        >
          {notes.map((note) => {
            const Icon = KIND_ICON[note.kind];
            const pop = freshNoteIds.delete(note.id);
            const label = spaces.find((s) => s.id === note.spaceId)?.name;
            if (layout === "list") {
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
            }
            const checklist = note.preview.checklist;
            return (
              <li
                key={note.id}
                className="board__item"
                onContextMenu={(event) => {
                  if (!canEdit) return;
                  event.preventDefault();
                  openMenu(note);
                }}
                onTouchStart={() => {
                  pressTimer.current = window.setTimeout(() => openMenu(note), 550);
                }}
                onTouchEnd={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
                onTouchMove={() => pressTimer.current && window.clearTimeout(pressTimer.current)}
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
              </li>
            );
          })}
        </ul>
      )}

      {hasNextPage && (
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
          onMove={(target) => void update(menuFor, { space_id: target })}
        />
      )}
    </>
  );
}
