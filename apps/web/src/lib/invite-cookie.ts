/** Holds a pending invite token across sign-in and onboarding (the magic link has no `next`). */
export const INVITE_COOKIE = "scraps_invite";
export const INVITE_COOKIE_MAX_AGE = 60 * 60;

/** Invite tokens are 64 hex characters; anything else is not ours and is ignored. */
export function isInviteToken(value: string | undefined | null): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}
