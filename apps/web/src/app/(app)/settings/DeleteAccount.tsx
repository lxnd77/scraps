"use client";

import { listSpaceMembers, type SpaceMember } from "@scraps/db";
import { Button, Dialog } from "@scraps/ui";
import { Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useShell } from "@/components/shell/ShellContext";
import { useT } from "@/copy/useT";
import { createClient } from "@/lib/supabase/client";

type Choice = { transfer: string } | { delete: true };

/**
 * Account deletion (SPEC 9.9). Shared spaces the person owns need an answer each: hand it to an
 * editor or delete it. Spaces nobody else is in are deleted. Typing the display name confirms.
 */
export function DeleteAccount() {
  const t = useT();
  const { profile, spaces, user } = useShell();
  const nameId = useId();
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState<Array<{ id: string; name: string; others: SpaceMember[] }>>(
    [],
  );
  const [choices, setChoices] = useState<Record<string, Choice | undefined>>({});
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const owned = spaces.filter((s) => s.role === "owner");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const db = createClient();
      const rows = await Promise.all(
        owned.map(async (space) => {
          const members = await listSpaceMembers(db, space.id).catch(() => []);
          return {
            id: space.id,
            name: space.name,
            others: members.filter((m) => m.userId !== user.id),
          };
        }),
      );
      if (!cancelled) setShared(rows.filter((r) => r.others.length > 0));
    })();
    return () => {
      cancelled = true;
    };
    // `owned` is derived from spaces; reload the member lists when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const soloNames = owned
    .filter((s) => !shared.some((x) => x.id === s.id))
    .map((s) => s.name);
  const answered = shared.every((s) => choices[s.id] !== undefined);
  const confirmed = typed.trim().toLowerCase() === profile.displayName.trim().toLowerCase();

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const spacesBody: Record<string, Choice> = {};
    for (const [id, choice] of Object.entries(choices)) if (choice) spacesBody[id] = choice;
    const supabase = createClient();
    const { error: failure } = await supabase.functions.invoke("delete-account", {
      body: { spaces: spacesBody },
    });
    if (failure) {
      setBusy(false);
      setError(t("account.delete.error"));
      return;
    }
    await supabase.auth.signOut().catch(() => undefined);
    window.location.assign("/sign-in");
  }

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Trash2 size={18} strokeWidth={2.6} aria-hidden="true" />
        {t("account.delete")}
      </Button>

      <Dialog open={open} onClose={close} title={t("account.delete.title")}>
        <div className="note-menu">
          <p className="field-hint">{t("account.delete.body")}</p>

          {soloNames.length > 0 && (
            <p className="field-hint">
              {t("account.delete.solo", { names: soloNames.join(", ") })}
            </p>
          )}

          {shared.map((space) => {
            const editors = space.others.filter((m) => m.role === "editor" || m.role === "owner");
            const choice = choices[space.id];
            const target = choice && "transfer" in choice ? choice.transfer : "";
            return (
              <fieldset key={space.id} className="picker">
                <legend className="field-label">
                  {t("account.delete.shared", { space: space.name })}
                </legend>
                {editors.length > 0 && (
                  <label className="choice">
                    <input
                      type="radio"
                      name={`space-${space.id}`}
                      className="picker__input"
                      checked={choice !== undefined && "transfer" in choice}
                      onChange={() =>
                        setChoices((c) => ({ ...c, [space.id]: { transfer: editors[0]!.userId } }))
                      }
                    />
                    <span className="choice__label">{t("account.delete.transfer")}</span>
                  </label>
                )}
                {editors.length > 0 && choice !== undefined && "transfer" in choice && (
                  <select
                    className="field-input"
                    aria-label={t("account.delete.transfer_to")}
                    value={target}
                    onChange={(e) =>
                      setChoices((c) => ({ ...c, [space.id]: { transfer: e.target.value } }))
                    }
                  >
                    {editors.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                )}
                <label className="choice">
                  <input
                    type="radio"
                    name={`space-${space.id}`}
                    className="picker__input"
                    checked={choice !== undefined && "delete" in choice}
                    onChange={() => setChoices((c) => ({ ...c, [space.id]: { delete: true } }))}
                  />
                  <span className="choice__label">{t("account.delete.remove")}</span>
                </label>
              </fieldset>
            );
          })}

          <div className="field">
            <label htmlFor={nameId} className="field-label">
              {t("account.delete.confirm", { name: profile.displayName })}
            </label>
            <input
              id={nameId}
              className="field-input"
              value={typed}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}

          <div className="space-form__actions">
            <Button variant="ghost" onClick={close}>
              {t("space.cancel")}
            </Button>
            <Button
              variant="dark"
              disabled={busy || !answered || !confirmed}
              onClick={() => void submit()}
            >
              {t("account.delete.yes")}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
