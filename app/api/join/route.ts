import { NextResponse } from "next/server";
import { join } from "@/lib/board";
import { readOnce } from "@/lib/stats";
import { oauthConfigured } from "@/lib/oauth";
import { makeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// Paste-a-token joining, for local development only (when Todoist sign-in isn't configured).
// The token is used once to read goals and counts, then discarded.
export async function POST(req: Request) {
  if (oauthConfigured())
    return NextResponse.json({ error: "Use “Connect with Todoist” to join." }, { status: 400 });
  const { name, token, code } = await req.json().catch(() => ({}));
  const cleanName = String(name ?? "").trim().slice(0, 40);
  const cleanToken = String(token ?? "").trim();
  if (process.env.JOIN_CODE && code !== process.env.JOIN_CODE)
    return NextResponse.json({ error: "Wrong join code." }, { status: 403 });
  if (!cleanName || !cleanToken)
    return NextResponse.json({ error: "Name and token are both required." }, { status: 400 });
  try {
    const { user, seed } = await readOnce(cleanToken);
    await join(cleanName, user, seed);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, makeSession(user.id), sessionCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "That Todoist token didn't work." }, { status: 400 });
  }
}
