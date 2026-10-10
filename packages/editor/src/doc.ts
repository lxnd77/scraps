import { TiptapTransformer } from "@hocuspocus/transformer";
import type { JSONContent } from "@tiptap/core";
import { getSchema } from "@tiptap/core";
import * as Y from "yjs";
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

let schema: ReturnType<typeof getSchema> | undefined;

/**
 * Throws unless the content satisfies the shared schema (title first, known nodes and attrs).
 * Used on documents that arrive from clients, which could otherwise store anything.
 */
export function validateContent(content: JSONContent): void {
  schema ??= getSchema(scrapsExtensions());
  schema.nodeFromJSON(content).check();
}

/** A Yjs state update from a client, validated against the schema, as a fresh document. */
export function ydocFromState(state: Uint8Array): Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  validateContent(ydocToContent(doc));
  return doc;
}

/** The `default` fragment of a Yjs document as ProseMirror JSON. */
export function ydocToContent(ydoc: Doc): JSONContent {
  return getTransformer().fromYdoc(ydoc, YDOC_FIELD) as JSONContent;
}
