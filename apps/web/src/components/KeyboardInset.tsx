"use client";

import { useEffect } from "react";

/**
 * Publishes the on-screen keyboard's height as `--keyboard-inset` on the root, so bottom-docked
 * controls (the phone block toolbar, the capture sheet) sit above it. Chrome on Android resizes
 * the page itself (`interactive-widget=resizes-content` in the viewport), which leaves this at 0;
 * iOS Safari only shrinks the visual viewport, and this is how the page finds out.
 */
export function KeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
      // small differences are browser chrome sliding, not a keyboard
      root.style.setProperty("--keyboard-inset", `${inset > 80 ? inset : 0}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--keyboard-inset");
    };
  }, []);
  return null;
}
