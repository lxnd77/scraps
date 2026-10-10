// Strips location and camera metadata from uploads before they are stored (SPEC 12: strip EXIF
// GPS). Pure TypeScript with no Deno or Node APIs so the Edge Function and the unit tests share it.
//
// JPEG: keeps the image segments, the JFIF header and the ICC colour profile (APP2), drops EXIF and
// XMP (APP1), IPTC (APP13) and comments. The EXIF orientation is carried over in a minimal EXIF
// segment of its own, because dropping it would turn a portrait photo on its side.
// PNG: drops the chunks that hold text, EXIF and timestamps.

export type ImageKind = "jpeg" | "png";

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "jpeg";
  if (
    bytes.length > 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  return null;
}

/** The EXIF orientation (1 to 8) found in an APP1 segment payload, or null. */
export function exifOrientation(exif: Uint8Array): number | null {
  // "Exif\0\0" then a TIFF header
  if (exif.length < 14) return null;
  const tag = String.fromCharCode(exif[0]!, exif[1]!, exif[2]!, exif[3]!);
  if (tag !== "Exif" || exif[4] !== 0 || exif[5] !== 0) return null;
  const big = exif[6] === 0x4d && exif[7] === 0x4d;
  const little = exif[6] === 0x49 && exif[7] === 0x49;
  if (!big && !little) return null;
  const view = new DataView(exif.buffer, exif.byteOffset, exif.byteLength);
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  const tiff = 6;
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > exif.length) return null;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > exif.length) return null;
    if (u16(entry) === 0x0112) {
      const value = u16(entry + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/** An APP1 segment holding nothing but the orientation tag (big endian). */
function orientationSegment(orientation: number): Uint8Array {
  const body = new Uint8Array([
    0x45,
    0x78,
    0x69,
    0x66,
    0x00,
    0x00, // "Exif\0\0"
    0x4d,
    0x4d,
    0x00,
    0x2a,
    0x00,
    0x00,
    0x00,
    0x08, // TIFF header, first IFD at 8
    0x00,
    0x01, // one entry
    0x01,
    0x12,
    0x00,
    0x03,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    orientation,
    0x00,
    0x00, // orientation
    0x00,
    0x00,
    0x00,
    0x00, // no next IFD
  ]);
  const length = body.length + 2;
  const segment = new Uint8Array(body.length + 4);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (length >> 8) & 0xff;
  segment[3] = length & 0xff;
  segment.set(body, 4);
  return segment;
}

/** Returns the JPEG without EXIF GPS and other metadata. Throws on a file that is not a JPEG. */
export function stripJpegMetadata(input: Uint8Array): Uint8Array {
  if (sniffImage(input) !== "jpeg") throw new Error("not a jpeg");
  const parts: Uint8Array[] = [input.subarray(0, 2)]; // SOI
  let orientation: number | null = null;
  let pos = 2;

  while (pos + 4 <= input.length) {
    if (input[pos] !== 0xff) throw new Error("corrupt jpeg");
    const marker = input[pos + 1]!;
    if (marker === 0xff) {
      pos += 1; // fill byte
      continue;
    }
    // start of scan: the compressed data runs to the end of the file, copy it verbatim
    if (marker === 0xda) {
      parts.push(input.subarray(pos));
      pos = input.length;
      break;
    }
    // markers with no length
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      parts.push(input.subarray(pos, pos + 2));
      pos += 2;
      continue;
    }
    const length = (input[pos + 2]! << 8) | input[pos + 3]!;
    if (length < 2 || pos + 2 + length > input.length) throw new Error("corrupt jpeg");
    const end = pos + 2 + length;
    const payload = input.subarray(pos + 4, end);

    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (marker === 0xe1) orientation ??= exifOrientation(payload);
    if (!drop) parts.push(input.subarray(pos, end));
    pos = end;
  }

  if (orientation !== null && orientation !== 1) {
    // right after SOI keeps it ahead of any JFIF-aware reader's expectations
    parts.splice(1, 0, orientationSegment(orientation));
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

const PNG_DROP = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);

/** Returns the PNG without text, EXIF and time chunks. Chunks are removed whole, so CRCs stay valid. */
export function stripPngMetadata(input: Uint8Array): Uint8Array {
  if (sniffImage(input) !== "png") throw new Error("not a png");
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  const parts: Uint8Array[] = [input.subarray(0, 8)];
  let pos = 8;
  while (pos + 12 <= input.length) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(
      input[pos + 4]!,
      input[pos + 5]!,
      input[pos + 6]!,
      input[pos + 7]!,
    );
    const end = pos + 12 + length;
    if (end > input.length) throw new Error("corrupt png");
    if (!PNG_DROP.has(type)) parts.push(input.subarray(pos, end));
    pos = end;
    if (type === "IEND") break;
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Sniffs the type, strips metadata, returns the bytes with their mime and extension. */
export function cleanImage(
  input: Uint8Array,
): { bytes: Uint8Array; mime: string; ext: string } | null {
  const kind = sniffImage(input);
  if (kind === "jpeg") return { bytes: stripJpegMetadata(input), mime: "image/jpeg", ext: "jpg" };
  if (kind === "png") return { bytes: stripPngMetadata(input), mime: "image/png", ext: "png" };
  return null;
}

/** Pixel size read from a JPEG start-of-frame marker or the PNG header, or null. */
export function imageSize(input: Uint8Array): { width: number; height: number } | null {
  const kind = sniffImage(input);
  if (kind === "png") {
    if (input.length < 24) return null;
    const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (kind !== "jpeg") return null;
  let pos = 2;
  while (pos + 9 < input.length) {
    if (input[pos] !== 0xff) return null;
    const marker = input[pos + 1]!;
    if (marker === 0xff) {
      pos += 1;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      pos += 2;
      continue;
    }
    const length = (input[pos + 2]! << 8) | input[pos + 3]!;
    const isFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      const height = (input[pos + 5]! << 8) | input[pos + 6]!;
      const width = (input[pos + 7]! << 8) | input[pos + 8]!;
      return width > 0 && height > 0 ? { width, height } : null;
    }
    pos += 2 + length;
  }
  return null;
}
