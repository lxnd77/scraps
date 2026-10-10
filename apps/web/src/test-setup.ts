import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  document.cookie = "scraps-theme=; path=/; max-age=0";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.removeAttribute("data-theme-pref");
});

// jsdom has no matchMedia; tests set `window.__prefersDark` to drive it.
declare global {
  interface Window {
    __prefersDark?: boolean;
  }
}

vi.stubGlobal(
  "matchMedia",
  (query: string): MediaQueryList =>
    ({
      matches: query.includes("prefers-color-scheme: dark") ? Boolean(window.__prefersDark) : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
);
