"use client";

import { useSyncExternalStore } from "react";
import * as Y from "yjs";

/** Text of the title node (the first child of the document fragment) as it is being typed. */
function readTitle(ydoc: Y.Doc): string {
  const first = ydoc.getXmlFragment("default").get(0);
  if (!(first instanceof Y.XmlElement)) return "";
  return first
    .toArray()
    .map((child) => (child instanceof Y.XmlText ? child.toJSON() : ""))
    .join("");
}

/** Live title for the breadcrumb and the browser tab, straight from the shared document. */
export function useLiveTitle(ydoc: Y.Doc, fallback: string): string {
  const title = useSyncExternalStore(
    (onChange) => {
      const fragment = ydoc.getXmlFragment("default");
      fragment.observeDeep(onChange);
      return () => fragment.unobserveDeep(onChange);
    },
    () => readTitle(ydoc),
    () => fallback,
  );
  return title;
}
