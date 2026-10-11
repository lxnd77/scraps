"use client";

import { Button } from "@scraps/ui";
import { Download } from "lucide-react";
import { useState } from "react";
import { useT } from "@/copy/useT";
import { accessToken } from "@/lib/auth-token";
import { ExportError, exportRemote, type ExportInfo } from "@/lib/collab";

type State =
  | { status: "idle" }
  | { status: "building" }
  | { status: "ready"; info: ExportInfo }
  | { status: "error"; limited: boolean };

/** "export everything": a zip of Markdown files and media, as a one hour link (SPEC 9.9). */
export function ExportData() {
  const t = useT();
  const [state, setState] = useState<State>({ status: "idle" });

  async function build() {
    setState({ status: "building" });
    try {
      setState({ status: "ready", info: await exportRemote(await accessToken()) });
    } catch (error) {
      setState({ status: "error", limited: error instanceof ExportError && error.status === 429 });
    }
  }

  return (
    <div className="export">
      <p className="field-hint">{t("export.hint")}</p>
      <div className="space-form__actions">
        <Button variant="ghost" disabled={state.status === "building"} onClick={() => void build()}>
          <Download size={18} strokeWidth={2.6} aria-hidden="true" />
          {state.status === "building" ? t("export.building") : t("export.button")}
        </Button>
        {state.status === "ready" && (
          <a href={state.info.url} className="sc-btn sc-btn--dark" download="scraps-export.zip">
            {t("export.download", { n: state.info.notes })}
          </a>
        )}
      </div>
      {state.status === "ready" && state.info.skipped > 0 && (
        <p className="field-hint">{t("export.skipped", { n: state.info.skipped })}</p>
      )}
      {state.status === "error" && (
        <p role="alert" className="field-error">
          {state.limited ? t("export.limit") : t("export.error")}
        </p>
      )}
    </div>
  );
}
