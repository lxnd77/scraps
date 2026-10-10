"use client";

import { Home, Layers, ListChecks, Plus, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/copy/useT";

/** Phone only: home, spaces, raised capture button, lists, profile. */
export function TabBar() {
  const t = useT();
  const pathname = usePathname();
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
            {/* wired to the capture sheet in Phase 3 */}
            <button
              type="button"
              className="tabbar__plus"
              aria-label={t("action.new_scrap")}
              aria-disabled="true"
              title={t("coming.soon")}
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
