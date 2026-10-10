"use client";

import { Button, Dialog, Toast } from "@scraps/ui";
import { Share, SquarePlus } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useT } from "@/copy/useT";

/** The event Chromium fires when the app can be installed. Not in the DOM lib. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const FLAG = "scraps.install.offered";

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

interface InstallValue {
  /** a native prompt is waiting, or the iOS how-to applies */
  available: boolean;
  /** already running as an installed app */
  installed: boolean;
  /** shows the native prompt, or the how-to sheet on iOS */
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
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [offered, setOffered] = useState(true); // hidden until we have read the flag
  const [howTo, setHowTo] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    // reading browser facts after mount keeps server and first client render the same
    /* eslint-disable react-hooks/set-state-in-effect */
    setInstalled(standalone);
    setIos(isIosSafari(navigator.userAgent, standalone));
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
    } else if (ios) {
      setHowTo(true);
    }
  }, [deferred, ios]);

  const dismiss = useCallback(() => {
    writeFlag();
    setOffered(true);
  }, []);

  const value = useMemo<InstallValue>(
    () => ({ available: !installed && (deferred !== null || ios), installed, install }),
    [installed, deferred, ios, install],
  );

  const showPrompt = !offered && !installed && (deferred !== null || ios);

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
      <Dialog open={howTo} onClose={() => setHowTo(false)} title={t("install.howto.title")}>
        <ol className="install-steps">
          <li>
            <Share size={20} strokeWidth={2.6} aria-hidden="true" />
            <span>{t("install.howto.step1")}</span>
          </li>
          <li>
            <SquarePlus size={20} strokeWidth={2.6} aria-hidden="true" />
            <span>{t("install.howto.step2")}</span>
          </li>
        </ol>
        <Button variant="dark" onClick={() => setHowTo(false)}>
          {t("install.howto.done")}
        </Button>
      </Dialog>
    </InstallContext.Provider>
  );
}
