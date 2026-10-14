import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(1234),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  /** defaults to the project's JWKS endpoint; local and hosted Supabase sign user tokens with ES256 */
  SUPABASE_JWKS_URL: z.url().optional(),
  /** only needed for projects that still sign with the legacy shared secret (HS256) */
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  /** shared with the `capture` Edge Function, which creates notes on a user's behalf */
  INTERNAL_SECRET: z.string().min(16, "INTERNAL_SECRET must be at least 16 characters"),
  ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3100")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /** SPEC 9.2: store 2 s after the last change, at least every 10 s */
  DEBOUNCE_MS: z.coerce.number().int().min(0).default(2000),
  MAX_DEBOUNCE_MS: z.coerce.number().int().min(0).default(10000),
  /** a note's card (notes row, one realtime event to every open board) at most this often */
  PREVIEW_INTERVAL_MS: z.coerce.number().int().min(0).default(10000),
});

export type CollabConfig = z.infer<typeof schema> & { jwksUrl: string };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CollabConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid collab configuration: ${problems}`);
  }
  const data = parsed.data;
  return {
    ...data,
    jwksUrl: data.SUPABASE_JWKS_URL ?? `${data.SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  };
}
