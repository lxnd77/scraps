"use client";

import { Button, Dialog, Toast } from "@scraps/ui";
import { EllipsisVertical, Info, PanelBottom, Pin, Share, SquarePlus } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CopyKey } from "@/copy/en";
import { useT } from "@/copy/useT";

/** The event Chromium fires when the app can be installed. Not in the DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const FLAG = "scraps.install.offered";
const PROMPT_DELAY_MS = 30_000;

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}
function writeFlag() {
  try {
    window.localStorage.setItem(FLAG, "1");
  } catch {
    // not remembered; the prompt may show again next visit
  }
}

/** Safari on iPhone or iPad has no install event: people add it from the share sheet. */
export function isIosSafari(userAgent: string, standalone: boolean): boolean {
  const ios = /iPad|iPhone|iPod/.test(userAgent);
  const webkit = /WebKit/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
  return ios && webkit && !standalone;
}

/** Browsers that never fire beforeinstallprompt but can install by hand, and how. */
export type ManualInstall = "ios" | "firefox-android" | "firefox-windows" | "firefox-other";

export function manualInstall(userAgent: string, standalone: boolean): ManualInstall | null {
  if (standalone) return null;
  if (isIosSafari(userAgent, standalone)) return "ios";
  if (!/Firefox\//.test(userAgent)) return null;
  if (/Android/.test(userAgent)) return "firefox-android";
  // Firefox 143+ on Windows can pin a site as a web app; macOS and Linux cannot yet
  return /Windows/.test(userAgent) ? "firefox-windows" : "firefox-other";
}

const HOW_TO: Record<ManualInstall, Array<{ icon: typeof Share; key: CopyKey }>> = {
  ios: [
    { icon: Share, key: "install.howto.step1" },
    { icon: SquarePlus, key: "install.howto.step2" },
  ],
  "firefox-android": [
    { icon: EllipsisVertical, key: "install.howto.ffa.step1" },
    { icon: SquarePlus, key: "install.howto.ffa.step2" },
  ],
  "firefox-windows": [
    { icon: PanelBottom, key: "install.howto.ffw.step1" },
    { icon: Pin, key: "install.howto.ffw.step2" },
  ],
  "firefox-other": [{ icon: Info, key: "install.howto.ffo" }],
};

interface InstallValue {
  /** a native prompt is waiting, or a how-to (iOS Safari, Firefox) applies */
  available: boolean;
  /** already running as an installed app */
  installed: boolean;
  /** shows the native prompt, or the how-to sheet */
  install: () => void;
}

const InstallContext = createContext<InstallValue>({
  available: false,
  installed: false,
  install: () => {},
});

export function useInstall(): InstallValue {
  return useContext(InstallContext);
}

/** Install prompt (phase 6.3): once, dismissible, and always reachable from settings. */
export function InstallProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [manual, setManual] = useState<ManualInstall | null>(null);
  const [installed, setInstalled] = useState(false);
  const [offered, setOffered] = useState(true); // hidden until we have read the flag
  const [howTo, setHowTo] = useState(false);
  // not on first paint: people get a while with the app before it asks for anything
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // reading browser facts after mount keeps server and first client render the same
    /* eslint-disable react-hooks/set-state-in-effect */
    setInstalled(standalone);
    setManual(manualInstall(navigator.userAgent, standalone));
    setOffered(readFlag());
    /* eslint-enable react-hooks/set-state-in-effect */

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (deferred) {
      void deferred
        .prompt()
        .then(() => deferred.userChoice)
        .finally(() => setDeferred(null));
    } else if (manual) {
      setHowTo(true);
    }
  }, [deferred, manual]);

  const dismiss = useCallback(() => {
    writeFlag();
    setOffered(true);
  }, []);

  const value = useMemo<InstallValue>(
    () => ({ available: !installed && (deferred !== null || manual !== null), installed, install }),
    [installed, deferred, manual, install],
  );

  // the toast offers only what can actually install; Firefox on macOS and Linux is settings only
  const canInstall = deferred !== null || (manual !== null && manual !== "firefox-other");
  const showPrompt = settled && !offered && !installed && canInstall;

  return (
    <InstallContext.Provider value={value}>
      {children}
      {showPrompt && (
        <div className="install-toast">
          <Toast
            variant="suggestion"
            acceptLabel={t("install.yes")}
            dismissLabel={t("install.no")}
            onAccept={() => {
              dismiss();
              install();
            }}
            onDismiss={dismiss}
          >
            {t("install.prompt")}
          </Toast>
        </div>
      )}
      <Dialog
        open={howTo}
        onClose={() => setHowTo(false)}
        title={t(
          manual === "firefox-windows" ? "install.howto.title.taskbar" : "install.howto.title",
        )}
      >
        <ol className="install-steps">
          {(manual ? HOW_TO[manual] : []).map(({ icon: Icon, key }) => (
            <li key={key}>
              <Icon size={20} strokeWidth={2.6} aria-hidden="true" />
              <span>{t(key)}</span>
            </li>
          ))}
        </ol>
        <Button variant="dark" onClick={() => setHowTo(false)}>
          {t("install.howto.done")}
        </Button>
      </Dialog>
    </InstallContext.Provider>
  );
}
