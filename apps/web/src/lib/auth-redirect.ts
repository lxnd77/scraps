import type { Db } from "@scraps/db";
import { NextResponse } from "next/server";
import { THEME_COOKIE } from "@/theme/theme";

/** Only same-site paths: "/foo" is fine, "//evil.test" and "https://evil.test" are not. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\"))
    return "/";
  return value;
}

/**
 * Redirect after a successful sign-in, applying the theme stored on the profile so a
 * browser with no cookie still gets the right theme.
 */
export async function redirectAfterSignIn(
  db: Db,
  userId: string,
  origin: string,
  next: string,
): Promise<NextResponse> {
  const response = NextResponse.redirect(new URL(safeNext(next), origin));
  const { data } = await db.from("profiles").select("theme").eq("id", userId).maybeSingle();
  if (data?.theme) {
    response.cookies.set(THEME_COOKIE, data.theme, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  return response;
}

export function requestOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
