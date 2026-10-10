import type { NextRequest } from "next/server";
import { redirectWithCookies, updateSession } from "@/lib/supabase/proxy";

/** Routes that never need a session (design tooling, the auth flow itself, the service worker). */
const PUBLIC_PREFIXES = ["/styleguide", "/spike", "/serwist", "/auth", "/sign-in", "/invite"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the session on every request and sends signed-out visitors to /sign-in.
 * This is an optimistic check only; pages and actions still verify the user themselves.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { response, user } = await updateSession(request);

  if (!user && !isPublic(pathname)) {
    return redirectWithCookies(request, response, "/sign-in");
  }
  if (user && pathname === "/sign-in") {
    return redirectWithCookies(request, response, "/");
  }
  return response;
}

export const config = {
  matcher: [
    // everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|css|map|txt|woff2?)$).*)",
  ],
};
