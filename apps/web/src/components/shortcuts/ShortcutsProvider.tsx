"use client";

import { Dialog } from "@scraps/ui";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useOptionalPalette } from "@/components/search/PaletteProvider";
import { useShell } from "@/components/shell/ShellContext";
import { useT } from "@/copy/useT";
import { isTypingTarget } from "@/lib/hotkeys";
import { matchShortcut, SEQUENCE_MS, SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { useTheme } from "@/theme/ThemeProvider";

const ShortcutsContext = createContext<{ openHelp: () => void } | null>(null);

/** Opens the cheat sheet from a button; null outside the provider. */
export function useShortcuts() {
  return useContext(ShortcutsContext);
}

/** The space the page is about: the board's id in the URL, or the scrap's space on a note page. */
function currentSpaceId(pathname: string): string | null {
  const match = /^\/s\/([^/]+)/.exec(pathname);
  if (match) return match[1] ?? null;
  return document.querySelector<HTMLElement>("[data-space-id]")?.dataset.spaceId ?? null;
}

/**
 * Desktop keyboard shortcuts (see lib/shortcuts.ts) and the "?" cheat sheet. Mounted once per
 * layout; "n" and mod+k stay with capture and search, which own them.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const palette = useOptionalPalette();
  const { spaces } = useShell();
  const { resolved, setTheme } = useTheme();
  const [help, setHelp] = useState(false);
  const [mac, setMac] = useState(false);
  const pending = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    // read after mount so server and first client render agree
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      const inEditor = Boolean(target?.closest?.(".ProseMirror"));
      const stale = pending.current && Date.now() - pending.current.at > SEQUENCE_MS;
      const { action, pending: next } = matchShortcut(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          typing: isTypingTarget(event.target),
          inEditor,
          modal: Boolean(document.querySelector("dialog[open], [role='menu']")),
          onNote: pathname.startsWith("/n/"),
        },
        stale ? null : (pending.current?.key ?? null),
      );
      pending.current = next ? { key: next, at: Date.now() } : null;
      if (!action) return;
      event.preventDefault();

      const spaceId = currentSpaceId(pathname);
      const index = spaces.findIndex((s) => s.id === spaceId);
      switch (action.type) {
        case "help":
          return setHelp(true);
        case "search":
          return palette?.open();
        case "theme":
          return setTheme(resolved === "midnight" ? "day" : "midnight");
        case "go": {
          if (action.to === "trash") {
            if (spaceId) router.push(`/s/${spaceId}/trash`);
            return;
          }
          const paths = { home: "/", spaces: "/spaces", lists: "/lists", settings: "/settings" };
          return router.push(paths[action.to]);
        }
        case "space": {
          const space = spaces[action.index];
          if (space) router.push(`/s/${space.id}`);
          return;
        }
        case "space-step": {
          if (spaces.length === 0) return;
          const from = index === -1 ? (action.by === 1 ? -1 : 0) : index;
          const space = spaces[(from + action.by + spaces.length) % spaces.length];
          if (space) router.push(`/s/${space.id}`);
          return;
        }
        case "leave-editor":
          return target?.blur();
        case "back-to-space":
          if (spaceId) router.push(`/s/${spaceId}`);
          return;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pathname, palette, spaces, resolved, setTheme, router]);

  const value = useMemo(() => ({ openHelp: () => setHelp(true) }), []);
  const keyLabel = (key: string) =>
    key === "mod" ? t(mac ? "keys.mod.mac" : "keys.mod.other") : key;

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
      <Dialog open={help} onClose={() => setHelp(false)} title={t("keys.title")} className="keys">
        <p className="keys__hint">{t("keys.hint")}</p>
        <div className="keys__groups">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} className="keys__group">
              <h3 className="sc-label keys__title">{t(group.title)}</h3>
              <dl className="keys__list">
                {group.items.map((item) => (
                  <div key={item.keys.join(" ") + item.label} className="keys__row">
                    <dt className="keys__keys">
                      {item.keys.map((key, i) => (
                        <Fragment key={i}>
                          {/* "g h" is a sequence, "mod k" a chord */}
                          {i > 0 && item.keys[0] === "g" && (
                            <span className="keys__then">{t("keys.then")}</span>
                          )}
                          {key === "…" ? (
                            <span className="keys__then">…</span>
                          ) : (
                            <kbd className="sc-mono keys__key">{keyLabel(key)}</kbd>
                          )}
                        </Fragment>
                      ))}
                    </dt>
                    <dd className="keys__label">{t(item.label)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Dialog>
    </ShortcutsContext.Provider>
  );
}
