import { TiptapTransformer } from "@hocuspocus/transformer";
import type { JSONContent } from "@tiptap/core";
import type { Doc } from "yjs";
import { YDOC_FIELD, scrapsExtensions } from "./extensions";

// Building a schema is not free, so the server-side extension list is built once.
let transformer: ReturnType<typeof TiptapTransformer.extensions> | undefined;

function getTransformer() {
  transformer ??= TiptapTransformer.extensions(scrapsExtensions());
  return transformer;
}

/** ProseMirror JSON into a fresh Yjs document (the `default` fragment). */
export function contentToYdoc(content: JSONContent): Doc {
  return getTransformer().toYdoc(content, YDOC_FIELD);
}

/** The `default` fragment of a Yjs document as ProseMirror JSON. */
export function ydocToContent(ydoc: Doc): JSONContent {
  return getTransformer().fromYdoc(ydoc, YDOC_FIELD) as JSONContent;
}
