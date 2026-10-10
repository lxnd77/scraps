"use client";

import { Sticker } from "@scraps/ui";
import Link from "next/link";
import { useT } from "@/copy/useT";

export default function NoteNotFound() {
  const t = useT();
  return (
    <main className="notfound">
      <Sticker id="sleepy-moon" size={120} />
      <h1 className="notfound__title">{t("note.denied.title")}</h1>
      <Link href="/" className="sc-btn sc-btn--dark">
        {t("error.back_to_board")}
      </Link>
    </main>
  );
}
