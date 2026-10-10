import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE } from "@/lib/invite-cookie";
import { requestOrigin, safeNext } from "@/lib/auth-redirect";

/** Drops the pending invite and continues to `to` (same-site paths only). */
export async function GET(request: NextRequest) {
  const to = safeNext(request.nextUrl.searchParams.get("to"));
  const response = NextResponse.redirect(new URL(to, requestOrigin(request)));
  response.cookies.delete(INVITE_COOKIE);
  return response;
}
