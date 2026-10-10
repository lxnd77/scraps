import { describe, expect, it } from "vitest";
import {
  MAX_SHARED_IMAGES,
  buildPayload,
  findUrl,
  isCapturableDrag,
  isEmptyPayload,
  parseShareForm,
  payloadFromDrop,
  shareKind,
} from "./payload";

const png = (name = "a.png", size = 10) =>
  new File([new Uint8Array(size).fill(1)], name, { type: "image/png" });
const audio = (name = "a.m4a") => new File([new Uint8Array(5).fill(1)], name, { type: "audio/mp4" });

describe("findUrl", () => {
  it("finds a link in a sentence and trims punctuation", () => {
    expect(findUrl("watch this (https://youtu.be/abc).")).toBe("https://youtu.be/abc");
  });
  it("ignores other schemes", () => {
    expect(findUrl("ftp://x.test/a")).toBeNull();
    expect(findUrl("plain words")).toBeNull();
  });
});

describe("buildPayload", () => {
  it("keeps title, text and url as given", () => {
    expect(
      buildPayload({ title: " a title ", text: "some words", url: "https://example.com/a" }),
    ).toEqual({ title: "a title", text: "some words", url: "https://example.com/a", files: [] });
  });

  it("lifts the address out of text when no url came along (YouTube on Android)", () => {
    const p = buildPayload({ text: "great set https://youtu.be/abc?t=2" });
    expect(p.url).toBe("https://youtu.be/abc?t=2");
    expect(p.text).toBe("great set");
  });

  it("drops text that only repeats the url", () => {
    const p = buildPayload({ url: "https://example.com/a", text: "https://example.com/a" });
    expect(p.url).toBe("https://example.com/a");
    expect(p.text).toBeUndefined();
  });

  it("ignores a url field that is not a web link", () => {
    expect(buildPayload({ url: "javascript:alert(1)" }).url).toBeUndefined();
  });

  it("ignores non-string fields", () => {
    expect(buildPayload({ title: 4, text: null, url: {} })).toEqual({
      title: undefined,
      text: undefined,
      url: undefined,
      files: [],
    });
  });

  it("keeps images and one audio file, drops everything else and empty files", () => {
    const files = [
      png("1.png"),
      new File(["x"], "doc.pdf", { type: "application/pdf" }),
      audio("1.m4a"),
      audio("2.m4a"),
      new File([], "empty.png", { type: "image/png" }),
      new File(["x"], "IMG_1.HEIC", { type: "" }),
    ];
    const p = buildPayload({ files });
    expect(p.files.map((f) => f.name)).toEqual(["1.png", "IMG_1.HEIC", "1.m4a"]);
  });

  it("caps images at what a mood board holds", () => {
    const files = Array.from({ length: 12 }, (_, i) => png(`${i}.png`));
    expect(buildPayload({ files }).files).toHaveLength(MAX_SHARED_IMAGES);
  });

  it("drops files over the size cap", () => {
    const big = { name: "big.png", type: "image/png", size: 50 * 1024 * 1024 } as File;
    expect(buildPayload({ files: [big] }).files).toEqual([]);
  });
});

describe("parseShareForm", () => {
  it("reads the fields the manifest declares", () => {
    const form = new FormData();
    form.set("title", "trip");
    form.set("text", "ideas");
    form.set("url", "https://example.com/");
    form.append("files", png("1.png"));
    form.append("files", png("2.png"));
    const p = parseShareForm(form);
    expect(p).toMatchObject({ title: "trip", text: "ideas", url: "https://example.com/" });
    expect(p.files).toHaveLength(2);
  });

  it("treats a string in the files field as nothing", () => {
    const form = new FormData();
    form.set("files", "not a file");
    expect(parseShareForm(form).files).toEqual([]);
  });
});

describe("shareKind", () => {
  it("picks the flow", () => {
    expect(shareKind({ files: [png(), png()] })).toBe("mood");
    expect(shareKind({ files: [png()], url: "https://a.test/" })).toBe("pic");
    expect(shareKind({ files: [], url: "https://a.test/" })).toBe("link");
    expect(shareKind({ files: [audio()] })).toBe("voice");
    expect(shareKind({ files: [], text: "hello" })).toBe("text");
    expect(shareKind({ files: [] })).toBeNull();
  });
  it("isEmptyPayload agrees", () => {
    expect(isEmptyPayload({ files: [] })).toBe(true);
    expect(isEmptyPayload({ files: [], text: "x" })).toBe(false);
  });
});

describe("payloadFromDrop", () => {
  const data = (map: Record<string, string>, files: File[] = []) => ({
    files,
    getData: (type: string) => map[type] ?? "",
  });

  it("uses the first address of a uri list and skips comments", () => {
    const p = payloadFromDrop(
      data({ "text/uri-list": "# dragged\r\nhttps://example.com/a\r\nhttps://other.test/" }),
    );
    expect(p.url).toBe("https://example.com/a");
  });
  it("reads dropped files", () => {
    expect(payloadFromDrop(data({}, [png(), png("b.png")])).files).toHaveLength(2);
  });
  it("falls back to dragged text", () => {
    expect(payloadFromDrop(data({ "text/plain": "a thought" })).text).toBe("a thought");
  });
});

describe("isCapturableDrag", () => {
  it("accepts files, links and text but not app-internal drags", () => {
    expect(isCapturableDrag(["Files"])).toBe(true);
    expect(isCapturableDrag(["text/uri-list", "text/plain"])).toBe(true);
    expect(isCapturableDrag(["application/x-scraps-card"])).toBe(false);
  });
});
