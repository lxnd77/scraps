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
import { useT } from "@/copy/useT";
import {
  isCapturableDrag,
  isEmptyPayload,
  payloadFromDrop,
  type SharePayload,
} from "@/lib/share/payload";
import { deleteShare, getShare } from "@/lib/share/store";
import { CaptureSheet } from "./CaptureSheet";

export interface CaptureOptions {
  spaceId?: string;
  text?: string;
  /** what another app shared or what was dropped on the board; opens the sheet prefilled */
  share?: SharePayload;
  /** id of a payload parked by the service worker; removed when the sheet closes */
  shareId?: string;
}

const SHARE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const close = useCallback(() => {
    setState((s) => {
      // the parked payload is cleared on save and on cancel alike
      if (s.options.shareId) void deleteShare(s.options.shareId).catch(() => {});
      return { ...s, open: false };
    });
  }, []);

  // the installed app's "new scrap" shortcut opens /?capture=new; a share from another app opens
  // /?capture=<share id>, whose payload the service worker parked in IndexedDB
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const capture = params.get("capture");
    if (!capture) return;
    params.delete("capture");
    const rest = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : ""));

    if (capture === "new") {
      // opening the sheet from a launch shortcut is a reaction to the URL, not derived state
      // eslint-disable-next-line react-hooks/set-state-in-effect
      openCapture();
    } else if (SHARE_ID.test(capture)) {
      void getShare(capture)
        .then((share) => openCapture(share ? { share, shareId: capture } : {}))
        .catch(() => openCapture());
    }
  }, [openCapture]);

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

  // dropping files, a link or text anywhere in the app opens the sheet prefilled (desktop)
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    // nested enters and leaves fire per child element; count them so the overlay does not flicker
    let depth = 0;
    const accepts = (event: DragEvent) =>
      !document.querySelector("dialog[open]") &&
      isCapturableDrag(Array.from(event.dataTransfer?.types ?? []));

    function onEnter(event: DragEvent) {
      if (!accepts(event)) return;
      depth += 1;
      setDragging(true);
    }
    function onOver(event: DragEvent) {
      if (!accepts(event)) return;
      event.preventDefault(); // makes the window a drop target
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    }
    function onLeave(event: DragEvent) {
      if (!accepts(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }
    function onDrop(event: DragEvent) {
      depth = 0;
      setDragging(false);
      if (!accepts(event) || !event.dataTransfer) return;
      event.preventDefault();
      const payload = payloadFromDrop({
        files: Array.from(event.dataTransfer.files),
        getData: (type) => event.dataTransfer?.getData(type) ?? "",
      });
      if (!isEmptyPayload(payload)) openCapture({ share: payload });
    }

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [openCapture]);

  const value = useMemo(() => ({ openCapture }), [openCapture]);
  const defaultSpace =
    state.options.spaceId ?? currentSpace ?? profile.defaultCaptureSpace ?? spaces[0]?.id ?? "";

  return (
    <CaptureContext.Provider value={value}>
      {children}
      {dragging && <DropOverlay />}
      <CaptureSheet
        open={state.open}
        onClose={close}
        defaultSpaceId={defaultSpace}
        initialText={state.options.text ?? ""}
        share={state.options.share}
      />
    </CaptureContext.Provider>
  );
}

function DropOverlay() {
  const t = useT();
  return (
    <div className="drop-overlay" aria-hidden="true">
      <p className="drop-overlay__text">{t("capture.drop")}</p>
    </div>
  );
}
