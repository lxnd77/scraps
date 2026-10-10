import type { Database } from "@scraps/db";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session cookies for a request and reports who is signed in.
 * Returns the response that carries any refreshed cookies; redirects must copy them over.
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasSessionCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!url || !key || !hasSessionCookie) return { response, user: null };

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser() validates the token with the auth server; getSession() would trust the cookie.
  const { data } = await supabase.auth.getUser();
  return { response, user: data.user };
}

/** Redirect while keeping any session cookies the refresh just set. */
export function redirectWithCookies(
  request: NextRequest,
  from: NextResponse,
  pathname: string,
): NextResponse {
  const target = request.nextUrl.clone();
  target.pathname = pathname;
  target.search = "";
  const redirect = NextResponse.redirect(target);
  for (const cookie of from.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}
