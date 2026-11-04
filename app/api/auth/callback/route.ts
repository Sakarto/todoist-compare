import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE } from "@/lib/oauth";
import { join } from "@/lib/board";
import { readOnce } from "@/lib/stats";
import { makeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// Todoist sends the person back here after they approve (or decline).
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const finish = (query: string) => {
    const res = NextResponse.redirect(new URL(`/?${query}`, req.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth" });
    return res;
  };
  const fail = (msg: string) => finish(`error=${encodeURIComponent(msg)}`);

  let saved: { state?: string; name?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}

  if (params.get("error")) return fail("Todoist access wasn't approved.");
  if (!saved.state || params.get("state") !== saved.state) return fail("Sign-in expired or didn't match. Try again.");
  const code = params.get("code");
  if (!code) return fail("Todoist didn't send a sign-in code.");

  let token: string;
  try {
    const tokenRes = await fetch("https://todoist.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.TODOIST_CLIENT_ID!,
        client_secret: process.env.TODOIST_CLIENT_SECRET!,
        code,
      }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) return fail("Couldn't finish connecting to Todoist.");
    token = tokenJson.access_token;
  } catch {
    return fail("Couldn't reach Todoist. Try again in a moment.");
  }

  // The token is used right here, then discarded. It is never stored.
  try {
    const { user, seed } = await readOnce(token);
    await join(saved.name || "Friend", user, seed);
    const res = finish("joined=1");
    res.cookies.set(SESSION_COOKIE, makeSession(user.id), sessionCookieOptions);
    return res;
  } catch {
    return fail("Connected, but couldn't read your Todoist stats.");
  }
}
