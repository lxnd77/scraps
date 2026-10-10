import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from "jose";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

export interface VerifiedUser {
  userId: string;
}

export type VerifyToken = (token: string) => Promise<VerifiedUser>;

const uuid = z.uuid();

/**
 * Verifies a Supabase access token. Asymmetric tokens (ES256, RS256) are checked against the
 * project's JWKS, which is what local and hosted Supabase use. HS256 is accepted only when a
 * shared secret is configured, and the algorithm is pinned so a token cannot pick its own.
 */
export function createTokenVerifier(options: { jwksUrl: string; jwtSecret?: string }): VerifyToken {
  const jwks = createRemoteJWKSet(new URL(options.jwksUrl), { cooldownDuration: 10_000 });
  const secret = options.jwtSecret ? new TextEncoder().encode(options.jwtSecret) : undefined;

  return async (token) => {
    const header = decodeProtectedHeader(token);
    let payload;
    if (header.alg === "HS256") {
      if (!secret) throw new Error("hs256 tokens are not accepted");
      ({ payload } = await jwtVerify(token, secret, {
        algorithms: ["HS256"],
        audience: "authenticated",
      }));
    } else {
      ({ payload } = await jwtVerify(token, jwks, {
        algorithms: ["ES256", "RS256", "EdDSA"],
        audience: "authenticated",
      }));
    }
    const sub = uuid.safeParse(payload.sub);
    if (!sub.success) throw new Error("token has no user");
    return { userId: sub.data };
  };
}

/** Constant-time string comparison for shared secrets. */
export function secretsMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function bearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? "");
  return match?.[1];
}
