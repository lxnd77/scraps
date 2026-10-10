/** Longest edge of a stored picture (SPEC 9.3). */
export const MAX_EDGE = 2048;
export const WEBP_QUALITY = 0.82;
export const MAX_INPUT_BYTES = 40 * 1024 * 1024;
export const MAX_GIF_BYTES = 8 * 1024 * 1024;

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

export type ImageProblem = "type" | "too_big" | "unreadable";

export class ImageError extends Error {
  constructor(readonly problem: ImageProblem) {
    super(problem);
  }
}

export function isAcceptedImageType(type: string): boolean {
  return ACCEPTED.includes(type.toLowerCase());
}

/** Checks a picked file before any work is done. Returns null when it is fine. */
export function checkImageFile(file: {
  type: string;
  size: number;
  name?: string;
}): ImageProblem | null {
  // some browsers report HEIC with an empty type; the extension is the fallback
  const type = file.type || (/\.(heic|heif)$/i.test(file.name ?? "") ? "image/heic" : "");
  if (!isAcceptedImageType(type)) return "type";
  if (file.size > MAX_INPUT_BYTES) return "too_big";
  if (type === "image/gif" && file.size > MAX_GIF_BYTES) return "too_big";
  return null;
}

/** Scales (w, h) down so the longer side is at most `max`; never scales up. */
export function fitWithin(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Average colour of RGBA pixel data as `#rrggbb`. */
export function averageColor(data: ArrayLike<number>): string {
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 16) continue; // skip transparent pixels
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
    n++;
  }
  if (n === 0) return "#cccccc";
  const hex = (v: number) =>
    Math.round(v / n)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export interface ProcessedImage {
  blob: Blob;
  mime: string;
  ext: string;
  width: number;
  height: number;
  color: string;
}

/**
 * Decodes, resizes to 2048px and re-encodes as WebP at 0.82. Drawing to a canvas drops every
 * EXIF block, GPS included. GIFs are kept as they are (animation) when under the size cap.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  const problem = checkImageFile(file);
  if (problem) throw new ImageError(problem);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // HEIC on a browser that cannot decode it, or a corrupt file
    throw new ImageError("unreadable");
  }

  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("unreadable");
    ctx.drawImage(bitmap, 0, 0, width, height);

    // 16px swatch for the loading box colour
    const swatch = document.createElement("canvas");
    swatch.width = 16;
    swatch.height = 16;
    const sctx = swatch.getContext("2d");
    sctx?.drawImage(bitmap, 0, 0, 16, 16);
    const color = sctx ? averageColor(sctx.getImageData(0, 0, 16, 16).data) : "#cccccc";

    if (file.type === "image/gif") {
      return {
        blob: file,
        mime: "image/gif",
        ext: "gif",
        width: bitmap.width,
        height: bitmap.height,
        color,
      };
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
    );
    if (!blob) throw new ImageError("unreadable");
    return { blob, mime: "image/webp", ext: "webp", width, height, color };
  } finally {
    bitmap.close();
  }
}
