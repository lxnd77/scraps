"use client";

import { Button, Dialog, Toast } from "@scraps/ui";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { setAiEnabled } from "@/app/(app)/actions";
import { useShell } from "@/components/shell/ShellContext";
import { useT } from "@/copy/useT";
import {
  acceptSuggestion,
  fetchPendingSuggestion,
  markSuggestion,
  requestSuggestion,
  type AiSuggestion,
} from "@/lib/ai/suggestions";
import { flushOutbox } from "@/lib/offline/runtime";
import { createClient } from "@/lib/supabase/client";

interface AiValue {
  /** a scrap was just saved: asks to opt in the first time, then suggests when it is on */
  afterCapture(noteId: string, spaceId: string): void;
  /** "suggest where this goes": the person asked for it on purpose */
  suggest(noteId: string, spaceId: string): void;
}

const AiContext = createContext<AiValue | null>(null);

export function useAi(): AiValue {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used inside the AI provider");
  return ctx;
}

const NOTICE_KEY = "scraps.ai-notice";

function noticeSeen(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === "1";
  } catch {
    return true; // cannot remember it, so do not nag
  }
}

function rememberNotice(): void {
  try {
    window.localStorage.setItem(NOTICE_KEY, "1");
  } catch {
    // shown again next time; harmless
  }
}

type ToastState =
  | { kind: "suggestion"; suggestion: AiSuggestion; currentSpaceId: string }
  | { kind: "message"; text: string };

/**
 * Suggestions after capture and on demand (SPEC 9.5). Owns the one-time opt-in dialog and the
 * "file under…?" toast. Nothing is applied until the person taps yes, and nothing is asked of the
 * model unless they opted in (the function checks the setting again on the server).
 */
export function AiProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile, spaces } = useShell();
  const [optIn, setOptIn] = useState<{ noteId: string; spaceId: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showNotice, setShowNotice] = useState(false);
  // the layout props refresh a moment after the server action; this bridges the gap
  const answered = useRef(false);
  // the dialog also fires onClose when it is closed by answering it, so answers are guarded by this
  const pendingOptIn = useRef<{ noteId: string; spaceId: string } | null>(null);
  const askOptIn = useCallback((value: { noteId: string; spaceId: string }) => {
    pendingOptIn.current = value;
    setOptIn(value);
  }, []);
  const enabled = useRef(profile.aiEnabled);
  useEffect(() => {
    enabled.current = profile.aiEnabled;
  }, [profile.aiEnabled]);

  const present = useCallback((next: ToastState) => {
    setToast(next);
    if (next.kind === "suggestion") setShowNotice(!noticeSeen());
  }, []);

  const run = useCallback(
    async (noteId: string, spaceId: string, manual: boolean) => {
      // the note has to exist on the server before it can be read there
      await flushOutbox().catch(() => undefined);
      const result = await requestSuggestion(noteId);
      if (result.status === "ok" && result.suggestion) {
        present({ kind: "suggestion", suggestion: result.suggestion, currentSpaceId: spaceId });
      } else if (manual) {
        const key = (
          {
            ok: "ai.toast.none",
            rate_limited: "ai.toast.limit",
            disabled: "ai.toast.disabled",
            unconfigured: "ai.toast.unconfigured",
            model_error: "ai.toast.model_error",
            error: "error.generic",
          } as const
        )[result.status];
        present({ kind: "message", text: t(key) });
      }
    },
    [present, t],
  );

  const afterCapture = useCallback(
    (noteId: string, spaceId: string) => {
      if (!profile.aiPrompted && !answered.current) {
        askOptIn({ noteId, spaceId });
      } else if (enabled.current) {
        void run(noteId, spaceId, false);
      }
    },
    [profile.aiPrompted, run, askOptIn],
  );

  const suggest = useCallback(
    (noteId: string, spaceId: string) => {
      if (enabled.current) void run(noteId, spaceId, true);
      else askOptIn({ noteId, spaceId });
    },
    [run, askOptIn],
  );

  // a capture from the shortcut has no screen to show a toast on: its suggestion waits here
  useEffect(() => {
    if (!profile.aiEnabled) return;
    let cancelled = false;
    void (async () => {
      const pending = await fetchPendingSuggestion();
      if (!pending || cancelled) return;
      const { data: note } = await createClient()
        .from("notes")
        .select("space_id, deleted_at")
        .eq("id", pending.noteId)
        .maybeSingle();
      if (cancelled) return;
      if (!note || note.deleted_at) {
        void markSuggestion(pending.id, "dismissed");
        return;
      }
      setToast((current) =>
        current
          ? current
          : { kind: "suggestion", suggestion: pending, currentSpaceId: note.space_id },
      );
      setShowNotice(!noticeSeen());
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.aiEnabled]);

  // plain messages go away on their own; a suggestion waits for yes or nah
  useEffect(() => {
    if (toast?.kind !== "message") return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  async function answerOptIn(yes: boolean) {
    const pending = pendingOptIn.current;
    if (!pending) return;
    pendingOptIn.current = null;
    setOptIn(null);
    answered.current = true;
    enabled.current = yes;
    await setAiEnabled(yes);
    if (yes) void run(pending.noteId, pending.spaceId, true);
  }

  async function accept() {
    if (toast?.kind !== "suggestion") return;
    const { suggestion, currentSpaceId } = toast;
    setToast(null);
    rememberNotice();
    try {
      await acceptSuggestion(suggestion, currentSpaceId);
      void flushOutbox().then(() => {
        void queryClient.invalidateQueries({ queryKey: ["board"] });
        void queryClient.invalidateQueries({ queryKey: ["kinds"] });
        router.refresh();
      });
    } catch {
      present({ kind: "message", text: t("error.generic") });
    }
  }

  function dismiss() {
    if (toast?.kind === "suggestion") void markSuggestion(toast.suggestion.id, "dismissed");
    rememberNotice();
    setToast(null);
  }

  const value = useMemo(() => ({ afterCapture, suggest }), [afterCapture, suggest]);

  const suggestion = toast?.kind === "suggestion" ? toast.suggestion : null;
  const spaceName = suggestion?.spaceId
    ? spaces.find((s) => s.id === suggestion.spaceId)?.name
    : undefined;

  return (
    <AiContext.Provider value={value}>
      {children}

      <Dialog
        open={optIn !== null}
        onClose={() => void answerOptIn(false)}
        title={t("ai.optin.title")}
      >
        <div className="note-menu">
          <p className="field-hint">{t("ai.optin.body")}</p>
          <div className="space-form__actions">
            <Button variant="ghost" onClick={() => void answerOptIn(false)}>
              {t("ai.optin.no")}
            </Button>
            <Button color="yellow" onClick={() => void answerOptIn(true)}>
              {t("ai.optin.yes")}
            </Button>
          </div>
        </div>
      </Dialog>

      {toast?.kind === "message" && (
        <div className="ai-toast">
          <Toast>{toast.text}</Toast>
        </div>
      )}

      {suggestion && (
        <div className="ai-toast">
          <Toast
            variant="suggestion"
            acceptLabel={t("ai.toast.yes")}
            dismissLabel={t("ai.toast.no")}
            onAccept={() => void accept()}
            onDismiss={dismiss}
          >
            <SuggestionText suggestion={suggestion} spaceName={spaceName} />
          </Toast>
          {showNotice && (
            <p className="ai-toast__notice sc-mono">
              {t("ai.toast.notice")} <Link href="/settings">{t("ai.toast.notice.link")}</Link>
            </p>
          )}
        </div>
      )}
    </AiContext.Provider>
  );
}

function SuggestionText({
  suggestion,
  spaceName,
}: {
  suggestion: AiSuggestion;
  spaceName: string | undefined;
}) {
  const t = useT();
  const parts: ReactNode[] = [];
  if (spaceName) {
    parts.push(
      <span key="space">
        {t("ai.toast.file")} <strong>{spaceName}</strong>?
      </span>,
    );
  }
  if (suggestion.tags.length > 0) {
    parts.push(
      <span key="tags">
        {t("ai.toast.add")} {suggestion.tags.map((tag) => `#${tag}`).join(" ")}
      </span>,
    );
  }
  if (suggestion.title) {
    parts.push(
      <span key="title">
        {t("ai.toast.title")} <strong>{suggestion.title}</strong>
      </span>,
    );
  }
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && " "}
          {part}
        </span>
      ))}
    </>
  );
}
