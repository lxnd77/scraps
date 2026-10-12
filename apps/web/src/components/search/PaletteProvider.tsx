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
import { CommandPalette } from "./CommandPalette";

interface PaletteValue {
  open: () => void;
  close: () => void;
}

const PaletteContext = createContext<PaletteValue | null>(null);

export function usePalette(): PaletteValue {
  const ctx = useContext(PaletteContext);
  if (!ctx) throw new Error("usePalette must be used inside the palette provider");
  return ctx;
}

/** The palette when one is mounted (the scrap page has none), for shortcuts that are optional. */
export function useOptionalPalette(): PaletteValue | null {
  return useContext(PaletteContext);
}

/** Owns the search palette: Cmd/Ctrl+K anywhere, or any search field calls open(). */
export function PaletteProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);
  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandPalette open={isOpen} onClose={close} />
    </PaletteContext.Provider>
  );
}
