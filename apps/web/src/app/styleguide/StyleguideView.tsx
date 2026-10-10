"use client";

import { BrandMark } from "@scraps/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";
import { Showcase } from "./Showcase";

function ThemePanel({
  theme,
  title,
  children,
}: {
  theme: "day" | "midnight";
  title: string;
  children: ReactNode;
}) {
  return (
    // data-theme scopes the token variables, so both themes render side by side
    <section
      data-theme={theme}
      aria-label={title}
      style={{
        background: "var(--bg)",
        color: "var(--ink)",
        border: "var(--border) solid var(--line)",
        borderRadius: "var(--radius-panel)",
        padding: 24,
        minWidth: 0,
      }}
    >
      <h2 style={{ margin: "0 0 20px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function StyleguideView() {
  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px clamp(18px, 3vw, 48px)",
          borderBottom: "var(--border) solid var(--divider)",
          background: "var(--surface)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <BrandMark size={40} />
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.05em" }}>
            styleguide
          </h1>
        </div>
        <nav
          aria-label="styleguide actions"
          style={{ display: "flex", alignItems: "center", gap: 16 }}
        >
          <Link href="/">home</Link>
          <HeaderThemeToggle />
        </nav>
      </header>

      <main
        className="grid grid-cols-1 gap-6 xl:grid-cols-2"
        style={{ padding: "24px clamp(18px, 3vw, 48px) 64px" }}
      >
        <ThemePanel theme="day" title="daylight">
          <Showcase night={false} />
        </ThemePanel>
        <ThemePanel theme="midnight" title="after midnight">
          <Showcase night />
        </ThemePanel>
      </main>
    </>
  );
}
