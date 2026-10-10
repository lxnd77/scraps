import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, isInviteToken } from "@/lib/invite-cookie";
import { requestOrigin } from "@/lib/auth-redirect";

/**
 * A signed-out visitor opened an invite link: remember the token and send them to sign in. After
 * sign-in (and onboarding, for new people) the app shell sends them back to the invite page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const origin = requestOrigin(request);
  if (!isInviteToken(token)) return NextResponse.redirect(new URL("/sign-in", origin));

  const response = NextResponse.redirect(new URL("/sign-in", origin));
  response.cookies.set(INVITE_COOKIE, token, {
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
  });
  return response;
}
