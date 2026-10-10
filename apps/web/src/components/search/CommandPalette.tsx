"use client";

import { searchNotes, type NoteKind, type NotesPage, type SpaceColor } from "@scraps/db";
import { Dialog, SpaceDot } from "@scraps/ui";
import { useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { searchLocal } from "@/lib/offline/localSearch";
import {
  FileText,
  Image as ImageIcon,
  Link2,
  ListChecks,
  Mic,
  Moon,
  Plus,
  Quote,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { useCapture } from "@/components/capture/CaptureProvider";
import { useShell } from "@/components/shell/ShellContext";
import { useT } from "@/copy/useT";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/theme/ThemeProvider";

const KIND_ICON = {
  text: FileText,
  list: ListChecks,
  pic: ImageIcon,
  link: Link2,
  voice: Mic,
  quote: Quote,
} as const;

/** Splits a snippet with `<<match>>` markers into plain and highlighted parts. */
export function snippetParts(snippet: string): Array<{ text: string; hit: boolean }> {
  return snippet
    .split(/(<<.*?>>)/g)
    .filter(Boolean)
    .map((part) =>
      part.startsWith("<<") && part.endsWith(">>")
        ? { text: part.slice(2, -2), hit: true }
        : { text: part, hit: false },
    );
}

interface Row {
  id: string;
  group: "search.group.scraps" | "search.group.spaces" | "search.group.actions";
  label: string;
  snippet?: string;
  icon: ReactIcon;
  dotColor?: string;
  run: () => void;
}
type ReactIcon = ComponentType<{ size?: number; strokeWidth?: number }>;

/** Cmd/Ctrl+K palette (SPEC 6.9): scraps, spaces and actions. Full screen on phones. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("search.title")} className="palette">
      {open && <PaletteBody onClose={onClose} />}
    </Dialog>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { spaces } = useShell();
  const { openCapture } = useCapture();
  const { resolved, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const id = window.setTimeout(() => input.current?.focus(), 30);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(query.trim()), 150);
    return () => window.clearTimeout(id);
  }, [query]);

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: async () => {
      // the board pages cached on this device, for when the server cannot be asked
      const local = () =>
        searchLocal(
          queryClient
            .getQueriesData<InfiniteData<NotesPage, number>>({ queryKey: ["board"] })
            .flatMap(([, data]) => data?.pages.flatMap((p) => p.notes) ?? []),
          debounced,
        );
      if (navigator.onLine === false) return { hits: local(), local: true };
      try {
        return { hits: await searchNotes(createClient(), debounced, 20), local: false };
      } catch {
        return { hits: local(), local: true };
      }
    },
    enabled: debounced.length > 0,
    staleTime: 10_000,
  });

  const rows = useMemo<Row[]>(() => {
    const needle = query.trim().toLowerCase();
    const out: Row[] = [];
    if (needle) {
      for (const hit of results.data?.hits ?? []) {
        out.push({
          id: `note-${hit.id}`,
          group: "search.group.scraps",
          label: hit.title || t("note.untitled"),
          snippet: hit.snippet,
          icon: KIND_ICON[hit.kind as NoteKind],
          run: () => router.push(`/n/${hit.id}`),
        });
      }
    }
    for (const space of spaces) {
      if (needle && !space.name.toLowerCase().includes(needle)) continue;
      out.push({
        id: `space-${space.id}`,
        group: "search.group.spaces",
        label: space.name,
        icon: Search,
        dotColor: space.color,
        run: () => router.push(`/s/${space.id}`),
      });
    }
    const actions: Row[] = [
      {
        id: "action-new",
        group: "search.group.actions",
        label: t("search.action.new"),
        icon: Plus,
        run: () => openCapture(),
      },
      {
        id: "action-theme",
        group: "search.group.actions",
        label: t("search.action.theme"),
        icon: Moon,
        run: () => setTheme(resolved === "midnight" ? "day" : "midnight"),
      },
    ];
    for (const action of actions) {
      if (!needle || action.label.includes(needle)) out.push(action);
    }
    return out;
    // t is stable per theme; router and setters are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results.data, spaces, resolved, t]);

  const current = Math.min(active, Math.max(rows.length - 1, 0));

  function choose(row: Row | undefined) {
    if (!row) return;
    onClose();
    // let the palette close before the next modal (capture) opens
    window.setTimeout(row.run, 0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((a) => (rows.length ? (a + 1) % rows.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => (rows.length ? (a - 1 + rows.length) % rows.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(rows[current]);
    }
  }

  const searching = results.isFetching && debounced.length > 0;
  const noScraps =
    debounced.length > 0 &&
    !results.isFetching &&
    !rows.some((r) => r.group === "search.group.scraps");

  let lastGroup: Row["group"] | null = null;

  return (
    <div className="palette__body">
      <label className="sc-search palette__field">
        <Search size={18} strokeWidth={2.4} aria-hidden="true" />
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={rows[current] ? `${listId}-${rows[current].id}` : undefined}
          aria-label={t("search.title")}
          placeholder={t("search.placeholder")}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
      </label>

      <p role="status" className="palette__status">
        {searching ? t("search.loading") : noScraps ? t("search.empty") : ""}
        {results.isError ? t("search.error") : ""}
        {results.data?.local ? t("search.local_only") : ""}
      </p>

      <ul id={listId} role="listbox" aria-label={t("search.results")} className="palette__list">
        {rows.map((row, index) => {
          const heading = row.group !== lastGroup;
          lastGroup = row.group;
          const Icon = row.icon;
          return (
            <Fragment key={row.id}>
              {heading && (
                <li role="presentation" className="sc-label palette__group">
                  {t(row.group)}
                </li>
              )}
              {/* keyboard selection lives on the combobox input above */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
              <li
                id={`${listId}-${row.id}`}
                role="option"
                aria-selected={index === current}
                className="palette__row"
                data-active={index === current}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(row)}
              >
                {row.dotColor ? (
                  <SpaceDot color={row.dotColor as SpaceColor} />
                ) : (
                  <span className="palette__icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={2.4} />
                  </span>
                )}
                <span className="palette__text">
                  <span className="palette__label">{row.label}</span>
                  {row.snippet && (
                    <span className="palette__snippet">
                      {snippetParts(row.snippet).map((part, i) =>
                        part.hit ? (
                          <mark key={i} className="palette__hit">
                            {part.text}
                          </mark>
                        ) : (
                          <Fragment key={i}>{part.text}</Fragment>
                        ),
                      )}
                    </span>
                  )}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ul>
    </div>
  );
}
