"use client";

import { BrandMark, SearchField, SpaceDot } from "@scraps/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  // streak counting arrives in Phase 3; the card holds its place with real copy
  const n: number = 0;
  return (
    <section className="streak" aria-label={t("streak.title", { n })}>
      <span className="sc-label">{t("streak.title", { n })}</span>
      <span className="streak__count">
        {n === 1 ? t("streak.count.one") : t("streak.count", { n })}
      </span>
      <span className="streak__body" data-theme-copy={resolved}>
        {t("streak.body")}
      </span>
    </section>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const { spaces } = useShell();
  const currentSpaceId = useCurrentSpaceId();
  const [creating, setCreating] = useState(false);

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
        title={t("coming.soon")}
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
