import { uuidv7 } from "@scraps/db";
import { t } from "@/copy/en";
import { averageColor, type ProcessedImage } from "@/lib/media/image";
import { storagePath, uploadImage } from "@/lib/media/upload";
import { createNote } from "@/lib/notes";

const TILES: Array<{ fill: string; shape: string }> = [
  { fill: "--c-yellow", shape: "--c-pink" },
  { fill: "--c-lilac", shape: "--c-lime" },
  { fill: "--c-lime", shape: "--c-blue" },
];

/** A flat picture drawn from the design tokens, so the mood board starter needs no asset files. */
async function drawTile(fillVar: string, shapeVar: string): Promise<ProcessedImage> {
  const css = getComputedStyle(document.documentElement);
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 450;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = css.getPropertyValue(fillVar).trim() || css.color;
  ctx.fillRect(0, 0, 600, 450);
  ctx.fillStyle = css.getPropertyValue(shapeVar).trim() || css.color;
  ctx.beginPath();
  ctx.arc(420, 160, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(60, 270, 280, 90);
  const color = averageColor(ctx.getImageData(0, 0, 8, 8).data);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", 0.82),
  );
  if (!blob) throw new Error("could not draw starter pic");
  return { blob, mime: "image/webp", ext: "webp", width: 600, height: 450, color };
}

/**
 * The scraps every new board starts with: a welcome note, a sample checklist, a sample quote and
 * a mood board (SPEC 6.6). They go through createNote(), the same client function the capture
 * sheet uses, so the Phase 6 outbox covers them too. Ids are passed in so a retry never
 * duplicates them.
 */
export async function createStarterScraps(spaceId: string, ids: string[]): Promise<void> {
  const [welcome, list, quote, mood] = ids;
  if (!welcome || !list || !quote || !mood) return;

  // sequential on purpose: the board lists newest first, so the welcome note lands on top
  try {
    const tiles = await Promise.all(TILES.map((tile) => drawTile(tile.fill, tile.shape)));
    const assets = tiles.map((processed) => {
      const assetId = uuidv7();
      return { processed, assetId, path: storagePath(mood, assetId, processed.ext) };
    });
    await createNote({
      id: mood,
      spaceId,
      start: "mood",
      title: t("starter.mood.title"),
      media: {
        images: assets.map((a, i) => ({
          assetId: a.assetId,
          path: a.path,
          caption: t(`starter.mood.${i + 1}` as "starter.mood.1"),
        })),
      },
    });
    for (const a of assets) {
      await uploadImage(mood, spaceId, new File([a.processed.blob], "starter.webp"), {
        assetId: a.assetId,
        processed: a.processed,
      });
    }
  } catch {
    // the other starters still land; the board works without the mood board
  }

  await createNote({ id: quote, spaceId, start: "quote", text: t("starter.quote.text") });
  await createNote({
    id: list,
    spaceId,
    start: "list",
    title: t("starter.list.title"),
    items: [t("starter.list.1"), t("starter.list.2"), t("starter.list.3")],
  });
  await createNote({
    id: welcome,
    spaceId,
    start: "text",
    title: t("starter.welcome.title"),
    text: t("starter.welcome.body"),
  });
}
