// Remembers which board member this browser belongs to, via a signed cookie.
// The cookie holds only the member's Todoist user ID plus a signature; no access token.
import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "tc_session";
export const SESSION_MAX_AGE = 400 * 86400; // browsers cap cookies at 400 days

function secret(): string {
  return process.env.SESSION_SECRET || process.env.TODOIST_CLIENT_SECRET || "dev-only-secret";
}

const sign = (uid: string, key = secret()) => createHmac("sha256", key).update(`session:${uid}`).digest("base64url");

export function makeSession(uid: string, key?: string): string {
  return `${uid}.${sign(uid, key)}`;
}

/** Returns the member ID if the cookie is genuine, else null. */
export function readSession(value: string | undefined | null, key?: string): string | null {
  if (!value) return null;
  const i = value.lastIndexOf(".");
  if (i <= 0) return null;
  const uid = value.slice(0, i);
  const given = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(sign(uid, key));
  return given.length === expected.length && timingSafeEqual(given, expected) ? uid : null;
}

export const sessionCookieOptions = {
  httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: SESSION_MAX_AGE,
};
