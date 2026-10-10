import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { MediaApi } from "./media";

export interface MediaDropOptions {
  getApi: () => MediaApi | null;
  /** +1 when an upload starts, -1 when it ends; drives the "uploading" status line */
  onBusy: (delta: number) => void;
  onError: (message: string) => void;
}

const IMAGE_TYPES = /^image\/(jpeg|png|webp|gif|heic|heif)$/i;

function imageFiles(list: FileList | File[] | null | undefined): File[] {
  return Array.from(list ?? []).filter(
    (f) => IMAGE_TYPES.test(f.type) || /\.(heic|heif)$/i.test(f.name),
  );
}

/** A single http(s) address and nothing else, or null. */
export function asSingleUrl(text: string): string | null {
  const value = text.trim();
  if (!value || /\s/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Drop and paste of pictures (one becomes an image, 2 to 9 a mood board) and a pasted URL on an
 * empty line (becomes a link card, with "keep as link" on the card to undo it).
 */
export const MediaDrop = Extension.create<MediaDropOptions>({
  name: "mediaDrop",

  addOptions() {
    return { getApi: () => null, onBusy: () => {}, onError: () => {} };
  },

  addProseMirrorPlugins() {
    const { getApi, onBusy, onError } = this.options;
    const editor: Editor = this.editor;

    async function insertImages(files: File[], pos: number | null) {
      const api = getApi();
      if (!api) return;
      onBusy(1);
      try {
        const uploaded = [];
        for (const file of files.slice(0, 9)) uploaded.push(await api.uploadImage(file));
        const content =
          uploaded.length === 1
            ? {
                type: "image",
                attrs: {
                  assetId: uploaded[0]!.assetId,
                  path: uploaded[0]!.path,
                  width: uploaded[0]!.width,
                  height: uploaded[0]!.height,
                  color: uploaded[0]!.color,
                },
              }
            : {
                type: "moodBoard",
                attrs: {
                  images: uploaded.map((u) => ({ assetId: u.assetId, path: u.path, caption: "" })),
                },
              };
        const chain = editor.chain().focus();
        if (pos === null) chain.insertContent(content).run();
        else chain.insertContentAt(pos, content).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        onError(
          message && !/^[a-z_]+$/.test(message) ? message : "couldn't upload that pic. try again.",
        );
      } finally {
        onBusy(-1);
      }
    }

    return [
      new Plugin({
        key: new PluginKey("scrapsMediaDrop"),
        props: {
          handleDrop(view, event) {
            if (!view.editable) return false;
            const files = imageFiles(event.dataTransfer?.files);
            if (files.length === 0) return false;
            event.preventDefault();
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
            // never drop a picture into the title
            const target = coords ? view.state.doc.resolve(coords.pos) : null;
            const at =
              target && target.parent.type.name !== "title"
                ? target.after(target.depth || 1)
                : null;
            void insertImages(files, at);
            return true;
          },

          handlePaste(view, event) {
            if (!view.editable) return false;
            const files = imageFiles(event.clipboardData?.files);
            if (files.length > 0) {
              event.preventDefault();
              void insertImages(files, null);
              return true;
            }

            const url = asSingleUrl(event.clipboardData?.getData("text/plain") ?? "");
            if (!url) return false;
            const { $from, empty } = view.state.selection;
            const onEmptyLine =
              empty &&
              $from.parent.type.name === "paragraph" &&
              $from.parent.content.size === 0 &&
              $from.depth === 1;
            if (!onEmptyLine) return false;
            event.preventDefault();
            editor
              .chain()
              .focus()
              .insertContentAt(
                { from: $from.before(), to: $from.after() },
                { type: "linkEmbed", attrs: { url } },
              )
              .run();
            return true;
          },
        },
      }),
    ];
  },
});
