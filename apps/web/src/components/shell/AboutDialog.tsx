"use client";

import { Dialog } from "@scraps/ui";
import Link from "next/link";
import { useT } from "@/copy/useT";

const CONTACT = "rishabh.bh7@gmail.com";

/** What scraps is, who made it and how to reach them (the sidebar's "?" and settings). */
export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Dialog open={open} onClose={onClose} title={t("about.title")} className="about">
      <p className="about__lead">{t("about.what")}</p>
      <p>{t("about.how")}</p>
      <dl className="about__facts">
        <div>
          <dt className="sc-label">{t("about.made_by")}</dt>
          <dd>Rishabh Bhargava</dd>
        </div>
        <div>
          <dt className="sc-label">{t("about.contact")}</dt>
          <dd>
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </dd>
        </div>
      </dl>
      <p className="sc-mono about__legal">
        <Link href="/privacy" onClick={onClose}>
          {t("auth.legal.privacy")}
        </Link>
        {" · "}
        <Link href="/terms" onClick={onClose}>
          {t("auth.legal.terms")}
        </Link>
      </p>
    </Dialog>
  );
}
