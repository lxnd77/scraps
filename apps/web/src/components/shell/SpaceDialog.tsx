"use client";

import { Button, Dialog } from "@scraps/ui";
import type { SpaceSummary } from "@scraps/db";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { createSpace, updateSpace, type FormState } from "@/app/(app)/actions";
import { useT } from "@/copy/useT";
import { ColorPicker } from "@/components/pickers";

const idle: FormState = { status: "idle" };

function SpaceForm({ space, onDone }: { space?: SpaceSummary; onDone: () => void }) {
  const t = useT();
  const router = useRouter();
  const [state, action, pending] = useActionState(space ? updateSpace : createSpace, idle);

  useEffect(() => {
    if (state.status !== "ok") return;
    onDone();
    if (!space && state.spaceId) router.push(`/s/${state.spaceId}`);
  }, [state, space, router, onDone]);

  const nameError = state.status === "error" ? (state.fieldErrors?.name ?? undefined) : undefined;
  const formError = state.status === "error" && state.messageKey ? t(state.messageKey) : undefined;

  return (
    <form action={action} className="space-form" noValidate>
      {space && <input type="hidden" name="id" value={space.id} />}
      <div className="field">
        <label htmlFor="space-name" className="field-label">
          {t("space.name")}
        </label>
        <input
          id="space-name"
          name="name"
          className="field-input"
          defaultValue={space?.name ?? ""}
          placeholder={t("space.name.placeholder")}
          maxLength={60}
          required
          autoComplete="off"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "space-name-error" : undefined}
        />
        {nameError && (
          <p id="space-name-error" role="alert" className="field-error">
            {nameError}
          </p>
        )}
      </div>
      <ColorPicker
        name="color"
        legend={t("space.colour")}
        defaultValue={space?.color ?? "yellow"}
      />
      {formError && (
        <p role="alert" className="field-error">
          {formError}
        </p>
      )}
      <div className="space-form__actions">
        <Button type="button" variant="ghost" onClick={onDone}>
          {t("space.cancel")}
        </Button>
        <Button type="submit" color="yellow" disabled={pending}>
          {t("space.save")}
        </Button>
      </div>
    </form>
  );
}

/** Create (no `space`) or edit a space. The form remounts on every open, so it always starts clean. */
export function SpaceDialog({
  open,
  onClose,
  space,
}: {
  open: boolean;
  onClose: () => void;
  space?: SpaceSummary;
}) {
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={space ? t("space.dialog.edit") : t("space.dialog.new")}
    >
      {open && <SpaceForm space={space} onDone={onClose} />}
    </Dialog>
  );
}
