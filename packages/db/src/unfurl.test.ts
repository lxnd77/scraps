import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  detectMediaType,
  parseHtmlPreview,
  parseIsoDuration,
  parseMapPin,
} from "./unfurl";

describe("parseHtmlPreview", () => {
  it("reads Open Graph tags in either attribute order", () => {
    const html = `<html><head><title>fallback</title>
      <meta property="og:title" content="Goa &amp; back">
      <meta content="train times for march" property="og:description">
      <meta property="og:image" content="/img/cover.jpg">
      <meta property="og:site_name" content="Trains">
    </head></html>`;
    expect(parseHtmlPreview(html, "https://trains.example/trip")).toEqual({
      title: "Goa & back",
      description: "train times for march",
      imageUrl: "https://trains.example/img/cover.jpg",
      siteName: "Trains",
      durationS: null,
    });
  });

  it("falls back to <title> and meta description", () => {
    const html = `<title> Plain   page </title><meta name="description" content="hello">`;
    const p = parseHtmlPreview(html, "https://example.com/");
    expect(p.title).toBe("Plain page");
    expect(p.description).toBe("hello");
    expect(p.imageUrl).toBeNull();
  });

  it("rejects non-http images and reads durations", () => {
    const html = `<meta property="og:image" content="javascript:alert(1)">
      <meta property="og:video:duration" content="253">`;
    const p = parseHtmlPreview(html, "https://example.com/");
    expect(p.imageUrl).toBeNull();
    expect(p.durationS).toBe(253);
  });

  it("reads an ISO duration from itemprop", () => {
    const p = parseHtmlPreview(`<meta itemprop="duration" content="PT4M13S">`, "https://youtu.be/x");
    expect(p.durationS).toBe(253);
  });
});

describe("helpers", () => {
  it("parses ISO durations", () => {
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("nonsense")).toBeNull();
    expect(parseIsoDuration("PT")).toBeNull();
  });

  it("decodes entities", () => {
    expect(decodeEntities("a &lt;b&gt; &#39;c&#39; &#x41;")).toBe("a <b> 'c' A");
  });

  it("detects video and map links", () => {
    expect(detectMediaType("https://www.youtube.com/watch?v=abc")).toBe("video");
    expect(detectMediaType("https://youtu.be/abc")).toBe("video");
    expect(detectMediaType("https://www.google.com/maps/place/x/@15.29,74.12,15z")).toBe("maps");
    expect(detectMediaType("https://maps.apple.com/?ll=15.29,74.12")).toBe("maps");
    expect(detectMediaType("https://example.com/post")).toBe("article");
  });

  it("finds a pin in map urls", () => {
    expect(parseMapPin("https://www.google.com/maps/place/Goa/@15.2993,74.124,12z")).toEqual({
      lat: 15.2993,
      lng: 74.124,
    });
    expect(parseMapPin("https://maps.apple.com/?ll=48.85,2.35")).toEqual({ lat: 48.85, lng: 2.35 });
    expect(parseMapPin("https://maps.apple.com/?q=cafe")).toBeNull();
  });
});
