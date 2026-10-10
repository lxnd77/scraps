import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { redirectAfterSignIn, requestOrigin } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "magiclink",
  "signup",
  "recovery",
  "invite",
  "email_change",
]);

/**
 * Magic link landing. The email carries a token hash instead of a PKCE code, so the link
 * works on any device, not just the browser that asked for it.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const origin = requestOrigin(request);

  if (!tokenHash || !type || !OTP_TYPES.has(type)) {
    return NextResponse.redirect(new URL("/sign-in?error=link", origin));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/sign-in?error=link", origin));
  }
  return redirectAfterSignIn(supabase, data.user.id, origin, params.get("next") ?? "/");
}
