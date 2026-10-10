"use client";

import { Sticker } from "@scraps/ui";
import Link from "next/link";
import { useT } from "@/copy/useT";

export default function SpaceNotFound() {
  const t = useT();
  return (
    <section className="notfound">
      <Sticker id="sleepy-moon" size={120} />
      <h1 className="notfound__title">{t("error.space_not_found.title")}</h1>
      <Link href="/" className="sc-btn sc-btn--dark">
        {t("error.back_to_board")}
      </Link>
    </section>
  );
}
