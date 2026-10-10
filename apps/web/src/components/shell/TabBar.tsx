"use client";

import { Home, Layers, ListChecks, Plus, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/copy/useT";
import { useCapture } from "@/components/capture/CaptureProvider";
import { useShell } from "./ShellContext";
import { useCurrentSpaceId } from "./Sidebar";

/** Phone only: home, spaces, raised capture button, lists, profile. */
export function TabBar() {
  const t = useT();
  const pathname = usePathname();
  const { profile, spaces } = useShell();
  const currentSpace = useCurrentSpaceId();
  // off a board (spaces, lists, profile) the + goes to the default capture space
  const target = currentSpace ?? profile.defaultCaptureSpace ?? spaces[0]?.id ?? null;
  const { openCapture } = useCapture();
  const items = [
    {
      href: "/",
      label: t("nav.home"),
      Icon: Home,
      active: pathname === "/" || pathname.startsWith("/s/"),
    },
    {
      href: "/spaces",
      label: t("nav.spaces"),
      Icon: Layers,
      active: pathname.startsWith("/spaces"),
    },
    null,
    {
      href: "/lists",
      label: t("nav.lists"),
      Icon: ListChecks,
      active: pathname.startsWith("/lists"),
    },
    {
      href: "/settings",
      label: t("nav.profile"),
      Icon: User,
      active: pathname.startsWith("/settings"),
    },
  ] as const;

  return (
    <nav className="tabbar" aria-label="main">
      {items.map((item) =>
        item === null ? (
          <span key="capture" className="tabbar__slot">
            <button
              type="button"
              className="tabbar__plus"
              aria-label={t("action.new_scrap")}
              onClick={() => openCapture(target ? { spaceId: target } : {})}
            >
              <Plus size={30} strokeWidth={3} aria-hidden="true" />
            </button>
          </span>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className="tabbar__item"
            aria-current={item.active ? "page" : undefined}
          >
            <item.Icon size={22} strokeWidth={2.4} aria-hidden="true" />
            <span className="tabbar__label">{item.label}</span>
          </Link>
        ),
      )}
    </nav>
  );
}
