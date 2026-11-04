import { NextResponse } from "next/server";
import { readOnce } from "@/lib/stats";
import { oauthConfigured } from "@/lib/oauth";
import { createPending, PENDING_COOKIE, pendingCookieOptions } from "@/lib/pending";

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
    const id = await createPending(cleanName, await readOnce(cleanToken));
    const res = NextResponse.json({ ok: true, setup: true });
    res.cookies.set(PENDING_COOKIE, id, pendingCookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "That Todoist token didn't work." }, { status: 400 });
  }
}
