import { NextResponse, type NextRequest } from "next/server";
import { redirectAfterSignIn, requestOrigin } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

/** OAuth (Google) lands here with a PKCE code. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const origin = requestOrigin(request);

  if (!code) return NextResponse.redirect(new URL("/sign-in?error=link", origin));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/sign-in?error=link", origin));

  return redirectAfterSignIn(supabase, data.user.id, origin, params.get("next") ?? "/");
}
