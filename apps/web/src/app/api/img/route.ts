import { safeFetch, BlockedUrlError } from "@scraps/db";
import { lookup } from "node:dns/promises";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Image proxy for link preview thumbnails: third-party hosts never see the reader, and the page
 * never loads images from arbitrary origins. Only URLs we stored in link_previews are fetched.
 */
export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get("u");
  if (!target || target.length > 2048) return new NextResponse(null, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse(null, { status: 401 });

  // the allow-list: an image some link preview in the database already points at
  const { data: known } = await supabase
    .from("link_previews")
    .select("url_hash")
    .eq("image_url", target)
    .limit(1)
    .maybeSingle();
  if (!known) return new NextResponse(null, { status: 404 });

  try {
    const upstream = await safeFetch(target, {
      resolve: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
      maxBytes: MAX_BYTES,
      headers: { accept: "image/*", "user-agent": "ScrapsImageProxy/1.0" },
    });
    const type = upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (upstream.status !== 200 || !type.startsWith("image/") || type.includes("svg")) {
      return new NextResponse(null, { status: 415 });
    }
    if (upstream.truncated) return new NextResponse(null, { status: 413 });
    return new NextResponse(Buffer.from(upstream.body), {
      status: 200,
      headers: {
        "content-type": type,
        "cache-control": "private, max-age=86400",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof BlockedUrlError) return new NextResponse(null, { status: 422 });
    return new NextResponse(null, { status: 502 });
  }
}
