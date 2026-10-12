/**
 * Public env, validated once. The literal `process.env.NEXT_PUBLIC_*` reads are
 * what Next inlines into the browser bundle, so they must stay spelled out.
 * The service-role key is never read here: it does not belong in apps/web.
 *
 * Plain checks instead of zod: this runs in the browser client on every route.
 */
export function publicEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !URL.canParse(supabaseUrl) || !supabaseKey) {
    throw new Error(
      "missing Supabase env. copy apps/web/.env.example to apps/web/.env.local and run `pnpm db:start`.",
    );
  }
  return { supabaseUrl, supabaseKey };
}
