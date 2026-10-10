"use client";

import { Avatar, BrandMark, Dialog, type StickerId } from "@scraps/ui";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useT } from "@/copy/useT";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";
import { useShell } from "./ShellContext";
import { SidebarContent } from "./Sidebar";
import { SyncIndicator } from "./SyncIndicator";

/**
 * Header for phone and tablet. On a phone the brand is just a mark; on a tablet it opens the
 * spaces drawer, which is the desktop sidebar in a sheet. Phone sub-screens hide the toggle.
 */
export function TopBar() {
  const t = useT();
  const { profile } = useShell();
  const [drawer, setDrawer] = useState(false);
  const closeDrawer = useCallback(() => setDrawer(false), []);

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__brand topbar__brand--drawer"
        aria-label={t("nav.menu")}
        onClick={() => setDrawer(true)}
      >
        <BrandMark size={36} />
        <span className="topbar__wordmark">scraps.</span>
      </button>
      <Link href="/" className="topbar__brand topbar__brand--static" aria-label="scraps. home">
        <BrandMark size={36} />
        <span className="topbar__wordmark">scraps.</span>
      </Link>

      <div className="topbar__actions">
        <SyncIndicator className="topbar__sync" />
        <HeaderThemeToggle size="md" />
        <Link href="/settings" aria-label={t("nav.profile")} className="topbar__avatar">
          <Avatar
            name={profile.displayName || "you"}
            sticker={profile.avatarSticker as StickerId}
            color="yellow"
            size={44}
          />
        </Link>
      </div>

      <Dialog open={drawer} onClose={closeDrawer} title={t("spaces.title")} variant="drawer">
        <SidebarContent onNavigate={closeDrawer} />
      </Dialog>
    </header>
  );
}
