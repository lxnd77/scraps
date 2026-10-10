"use client";

import { BrandMark, Sparkle } from "@scraps/ui";
import { useT } from "@/copy/useT";
import { HeaderThemeToggle } from "@/theme/HeaderThemeToggle";

export function SignInHeader() {
  const t = useT();
  return (
    <header className="auth-header">
      <div className="auth-header__top">
        <BrandMark size={56} />
        <HeaderThemeToggle size="md" />
      </div>
      <h1 className="auth-wordmark">scraps.</h1>
      <p className="auth-tagline">{t("auth.tagline")}</p>
      <Sparkle className="auth-star auth-star--a" size={22} color="yellow" />
      <Sparkle className="auth-star auth-star--b" size={14} color="pink" />
    </header>
  );
}
