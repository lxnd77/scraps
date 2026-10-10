"use client";

import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";

/**
 * Title row for sub pages (spaces, lists, settings). On desktop there is no top bar, so the
 * theme toggle lives here; below 1024px the top bar already carries it.
 */
export function PageHeading({ title }: { title: string }) {
  return (
    <header className="page__header">
      <h1 className="page__title">{title}</h1>
      <span className="page__toggle">
        <HeaderThemeToggle size="lg" />
      </span>
    </header>
  );
}
