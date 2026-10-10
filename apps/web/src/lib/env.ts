import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

/**
 * Public env, validated once. The literal `process.env.NEXT_PUBLIC_*` reads are
 * what Next inlines into the browser bundle, so they must stay spelled out.
 * The service-role key is never read here: it does not belong in apps/web.
 */
export function publicEnv() {
  const parsed = schema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "missing Supabase env. copy apps/web/.env.example to apps/web/.env.local and run `pnpm db:start`.",
    );
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
