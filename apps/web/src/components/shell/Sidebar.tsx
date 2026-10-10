"use client";

import { getStreak } from "@scraps/db";
import { AvatarStack, BrandMark, SearchField, SpaceDot, Sparkle, type StickerId } from "@scraps/ui";
import { avatarColorFor } from "@/lib/presence";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { usePalette } from "@/components/search/PaletteProvider";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/copy/useT";
import { useTheme } from "@/theme/ThemeProvider";
import { useShell } from "./ShellContext";
import { SpaceDialog } from "./SpaceDialog";

/** The id of the space on screen: /s/[id] wins, otherwise the default capture space. */
export function useCurrentSpaceId(): string | null {
  const pathname = usePathname();
  const { profile, spaces } = useShell();
  const match = /^\/s\/([^/]+)/.exec(pathname);
  if (match) return match[1] ?? null;
  if (pathname === "/") return profile.defaultCaptureSpace ?? spaces[0]?.id ?? null;
  return null;
}

function StreakCard() {
  const t = useT();
  const { resolved } = useTheme();
  const { streak: initial } = useShell();
  const { data } = useQuery({
    queryKey: ["streak"],
    queryFn: () => getStreak(createClient()),
    initialData: initial,
    staleTime: 60_000,
  });
  const n = data.streak;

  // a short sparkle burst the first time today's scrap lands
  const wasActive = useRef(data.activeToday);
  const [burst, setBurst] = useState(false);
  useEffect(() => {
    if (!wasActive.current && data.activeToday) {
      setBurst(true);
      const id = window.setTimeout(() => setBurst(false), 1400);
      return () => window.clearTimeout(id);
    }
    wasActive.current = data.activeToday;
  }, [data.activeToday]);

  return (
    <section className="streak" aria-label={t("streak.title", { n })} data-burst={burst}>
      <span className="sc-label">{t("streak.title", { n })}</span>
      <span className="streak__count">
        {n === 1 ? t("streak.count.one") : t("streak.count", { n })}
      </span>
      <span className="streak__body" data-theme-copy={resolved}>
        {t("streak.body")}
      </span>
      {burst && (
        <span className="streak__burst" aria-hidden="true">
          <Sparkle size={22} color="yellow" />
          <Sparkle size={14} color="pink" />
          <Sparkle size={18} color="ink" />
        </span>
      )}
    </section>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const { spaces, members } = useShell();
  const currentSpaceId = useCurrentSpaceId();
  const [creating, setCreating] = useState(false);
  const palette = usePalette();

  return (
    <div className="sidebar">
      <Link href="/" className="sidebar__brand" onClick={onNavigate} aria-label="scraps. home">
        <BrandMark size={46} />
        <span className="sidebar__wordmark">scraps.</span>
      </Link>

      <SearchField
        aria-label="search scraps"
        placeholder={t("search.placeholder")}
        hint="⌘K"
        readOnly
        onClick={() => {
          onNavigate?.();
          palette.open();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onNavigate?.();
            palette.open();
          }
        }}
      />

      <nav aria-label={t("spaces.title")} className="sidebar__spaces">
        <span className="sc-label sidebar__label">{t("spaces.title")}</span>
        {spaces.map((space) => {
          const active = space.id === currentSpaceId;
          return (
            <Link
              key={space.id}
              href={`/s/${space.id}`}
              className="space-row"
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
            >
              <SpaceDot color={space.color} />
              <span className="space-row__name">{space.name}</span>
              {(members[space.id]?.length ?? 0) > 1 && (
                <AvatarStack
                  className="space-row__people"
                  size={22}
                  max={3}
                  people={(members[space.id] ?? []).map((m) => ({
                    name: m.displayName || "someone",
                    sticker: m.avatarSticker as StickerId,
                    color: avatarColorFor(m.userId),
                  }))}
                />
              )}
              <span className="sc-mono space-row__count">{space.noteCount}</span>
            </Link>
          );
        })}
        <button
          type="button"
          className="space-row space-row--new"
          onClick={() => setCreating(true)}
        >
          <Plus size={16} strokeWidth={2.6} aria-hidden="true" />
          {t("action.new_space")}
        </button>
      </nav>

      <StreakCard />

      <SpaceDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
