import { describe, expect, it } from "vitest";
import {
  bearerToken,
  cleanImage,
  exifOrientation,
  findUrl,
  hashToken,
  imageSize,
  parseCaptureInput,
  planNote,
  sniffImage,
  stripJpegMetadata,
  stripPngMetadata,
  uuidv7,
} from "./capture";

const TOKEN = `scr_${"ab".repeat(32)}`;

describe("bearerToken", () => {
  it("accepts a well formed token", () => {
    expect(bearerToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(bearerToken(`bearer ${TOKEN}`)).toBe(TOKEN);
  });
  it("rejects missing, malformed and wrong-prefix values", () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken("")).toBeNull();
    expect(bearerToken(TOKEN)).toBeNull();
    expect(bearerToken("Bearer nope")).toBeNull();
    expect(bearerToken(`Bearer x${TOKEN}`)).toBeNull();
    expect(bearerToken(`Bearer ${TOKEN}00`)).toBeNull();
  });
});

describe("hashToken", () => {
  it("is SHA-256 in lowercase hex", async () => {
    // sha256("abc")
    expect(await hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("findUrl", () => {
  it("pulls a link out of a sentence and trims trailing punctuation", () => {
    expect(findUrl("look at this (https://youtu.be/abc?t=4).")).toBe("https://youtu.be/abc?t=4");
  });
  it("ignores other schemes and plain text", () => {
    expect(findUrl("javascript:alert(1)")).toBeNull();
    expect(findUrl("no link here")).toBeNull();
  });
});

describe("parseCaptureInput", () => {
  it("accepts url, text and title", () => {
    expect(parseCaptureInput({ url: "https://example.com/a", title: " hi " })).toEqual({
      ok: true,
      value: { url: "https://example.com/a", title: "hi" },
    });
  });
  it("promotes a link that is the whole text", () => {
    const r = parseCaptureInput({ text: "https://example.com/a" });
    expect(r).toEqual({ ok: true, value: { url: "https://example.com/a" } });
  });
  it("keeps text that only contains a link", () => {
    const r = parseCaptureInput({ text: "read this https://example.com/a tonight" });
    expect(r).toEqual({ ok: true, value: { text: "read this https://example.com/a tonight" } });
  });
  it("rejects empty bodies, wrong types and non-links in url", () => {
    expect(parseCaptureInput({})).toEqual({ ok: false, error: "empty" });
    expect(parseCaptureInput({ text: 4 })).toEqual({ ok: false, error: "invalid_request" });
    expect(parseCaptureInput([])).toEqual({ ok: false, error: "invalid_request" });
    expect(parseCaptureInput(null)).toEqual({ ok: false, error: "invalid_request" });
    expect(parseCaptureInput({ url: "ftp://x.test/a" })).toEqual({
      ok: false,
      error: "invalid_request",
    });
  });
  it("enforces length limits", () => {
    expect(parseCaptureInput({ title: "x".repeat(121) }).ok).toBe(false);
    expect(parseCaptureInput({ text: "x".repeat(10_001) }).ok).toBe(false);
  });
  it("allows an empty body when an image came along", () => {
    expect(parseCaptureInput({}, { allowEmpty: true })).toEqual({ ok: true, value: {} });
  });
});

describe("planNote", () => {
  it("makes a link scrap from a url", () => {
    expect(planNote({ url: "https://example.com/" }, false)).toMatchObject({ start: "link" });
  });
  it("splits text into title and body", () => {
    expect(planNote({ text: "buy oat milk\nand tea" }, false)).toEqual({
      start: "text",
      title: "buy oat milk",
      text: "and tea",
    });
  });
  it("uses an explicit title and keeps the whole text", () => {
    expect(planNote({ title: "groceries", text: "oat milk" }, false)).toEqual({
      start: "text",
      title: "groceries",
      text: "oat milk",
    });
  });
  it("makes an image scrap with the first line as title", () => {
    expect(planNote({ text: "sunset\nfrom the roof" }, true)).toEqual({
      start: "image",
      title: "sunset",
    });
  });
});

describe("uuidv7", () => {
  it("has version 7, the RFC variant and sorts by time", () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_001_000);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});

// ---- images -----------------------------------------------------------------------------------

function segment(marker: number, payload: number[]): number[] {
  const length = payload.length + 2;
  return [0xff, marker, length >> 8, length & 0xff, ...payload];
}

/** An EXIF segment payload with an orientation tag and a GPS pointer tag. */
function exif(orientation: number): number[] {
  return [
    ...Array.from("Exif").map((c) => c.charCodeAt(0)),
    0,
    0,
    0x4d,
    0x4d,
    0,
    0x2a,
    0,
    0,
    0,
    8,
    0,
    2, // two entries: orientation and a fake GPS pointer
    0x01,
    0x12,
    0,
    3,
    0,
    0,
    0,
    1,
    0,
    orientation,
    0,
    0,
    0x88,
    0x25,
    0,
    4,
    0,
    0,
    0,
    1,
    0,
    0,
    0,
    0x1a,
    0,
    0,
    0,
    0,
  ];
}

const EXIF_GPS = exif(6);

function jpeg(...segments: number[][]): Uint8Array {
  const sof = segment(0xc0, [8, 0, 20, 0, 30, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  const sos = [0xff, 0xda, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0, 0x12, 0x34, 0xff, 0xd9];
  return Uint8Array.from([0xff, 0xd8, ...segments.flat(), ...sof, ...sos]);
}

describe("sniffImage", () => {
  it("recognises JPEG and PNG by their bytes, not their name", () => {
    expect(sniffImage(jpeg())).toBe("jpeg");
    expect(sniffImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(
      "png",
    );
    expect(sniffImage(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });
});

describe("stripJpegMetadata", () => {
  it("drops EXIF (with GPS), XMP, IPTC and comments but keeps the image data", () => {
    const input = jpeg(
      segment(0xe0, [0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]),
      segment(0xe1, exif(1)),
      segment(
        0xe1,
        Array.from("http://ns.adobe.com/xap/1.0/\0<x/>").map((c) => c.charCodeAt(0)),
      ),
      segment(0xed, [1, 2, 3]),
      segment(
        0xfe,
        Array.from("shot at home").map((c) => c.charCodeAt(0)),
      ),
      segment(
        0xe2,
        Array.from("ICC_PROFILE\0").map((c) => c.charCodeAt(0)),
      ),
    );
    const out = stripJpegMetadata(input);
    const text = new TextDecoder("latin1").decode(out);
    expect(text).not.toContain("Exif");
    expect(text).not.toContain("adobe");
    expect(text).not.toContain("shot at home");
    expect(text).toContain("ICC_PROFILE");
    expect(text).toContain("JFIF");
    expect(imageSize(out)).toEqual({ width: 30, height: 20 });
    // the compressed scan is untouched
    expect([...out.slice(-4)]).toEqual([0x12, 0x34, 0xff, 0xd9]);
    expect(out.length).toBeLessThan(input.length);
  });

  it("keeps only the orientation of a rotated photo", () => {
    const out = stripJpegMetadata(jpeg(segment(0xe1, EXIF_GPS)));
    const app1 = out.slice(2, 4);
    expect([...app1]).toEqual([0xff, 0xe1]);
    const payload = out.slice(6, 4 + ((out[4]! << 8) | out[5]!));
    expect(exifOrientation(payload)).toBe(6);
    // no GPS pointer tag (0x8825) survives
    expect(payload.includes(0x88)).toBe(false);
  });

  it("refuses files that are not JPEGs and truncated segments", () => {
    expect(() => stripJpegMetadata(new TextEncoder().encode("hello"))).toThrow();
    expect(() =>
      stripJpegMetadata(Uint8Array.from([0xff, 0xd8, 0xff, 0xe1, 0x7f, 0xff, 1])),
    ).toThrow();
  });
});

function pngChunk(type: string, data: number[]): number[] {
  const len = data.length;
  return [
    (len >>> 24) & 0xff,
    (len >>> 16) & 0xff,
    (len >>> 8) & 0xff,
    len & 0xff,
    ...Array.from(type).map((c) => c.charCodeAt(0)),
    ...data,
    0,
    0,
    0,
    0, // crc is not checked by the filter
  ];
}

describe("stripPngMetadata", () => {
  it("removes text, exif and time chunks whole", () => {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const ihdr = [0, 0, 0, 40, 0, 0, 0, 30, 8, 6, 0, 0, 0];
    const png = Uint8Array.from([
      ...sig,
      ...pngChunk("IHDR", ihdr),
      ...pngChunk(
        "tEXt",
        Array.from("Comment\0home").map((c) => c.charCodeAt(0)),
      ),
      ...pngChunk("eXIf", [1, 2, 3, 4]),
      ...pngChunk("IDAT", [9, 9, 9]),
      ...pngChunk("tIME", [0, 0, 0, 0, 0, 0, 0]),
      ...pngChunk("IEND", []),
    ]);
    const out = stripPngMetadata(png);
    const text = new TextDecoder("latin1").decode(out);
    expect(text).toContain("IHDR");
    expect(text).toContain("IDAT");
    expect(text).toContain("IEND");
    expect(text).not.toContain("tEXt");
    expect(text).not.toContain("eXIf");
    expect(text).not.toContain("tIME");
    expect(imageSize(out)).toEqual({ width: 40, height: 30 });
  });
});

describe("cleanImage", () => {
  it("returns null for anything that is not JPEG or PNG (HEIC, WebP, SVG)", () => {
    expect(cleanImage(new TextEncoder().encode("RIFF....WEBPVP8 "))).toBeNull();
    expect(
      cleanImage(Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63])),
    ).toBeNull();
  });
  it("reports mime and extension", () => {
    expect(cleanImage(jpeg())).toMatchObject({ mime: "image/jpeg", ext: "jpg" });
  });
});
