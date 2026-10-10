"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { isPlainKey, isTypingTarget } from "@/lib/hotkeys";
import { useShell } from "@/components/shell/ShellContext";
import { useCurrentSpaceId } from "@/components/shell/Sidebar";
import { CaptureSheet } from "./CaptureSheet";

export interface CaptureOptions {
  spaceId?: string;
  text?: string;
}

interface CaptureValue {
  openCapture: (options?: CaptureOptions) => void;
}

const CaptureContext = createContext<CaptureValue | null>(null);

export function useCapture(): CaptureValue {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used inside the capture provider");
  return ctx;
}

/** Owns the quick capture sheet and its entry points: buttons call openCapture(), `N` opens it. */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const { profile, spaces } = useShell();
  const currentSpace = useCurrentSpaceId();
  const [state, setState] = useState<{ open: boolean; options: CaptureOptions }>({
    open: false,
    options: {},
  });

  const openCapture = useCallback((options: CaptureOptions = {}) => {
    setState({ open: true, options });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isPlainKey(event, "n") || event.repeat) return;
      if (isTypingTarget(event.target)) return;
      // another modal (menu, search) owns the keyboard
      if (document.querySelector("dialog[open]")) return;
      event.preventDefault();
      openCapture();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openCapture]);

  const value = useMemo(() => ({ openCapture }), [openCapture]);
  const defaultSpace =
    state.options.spaceId ?? currentSpace ?? profile.defaultCaptureSpace ?? spaces[0]?.id ?? "";

  return (
    <CaptureContext.Provider value={value}>
      {children}
      <CaptureSheet
        open={state.open}
        onClose={close}
        defaultSpaceId={defaultSpace}
        initialText={state.options.text ?? ""}
      />
    </CaptureContext.Provider>
  );
}
