import { NextResponse } from "next/server";
import { storageReady, upsertMember } from "@/lib/store";
import { fetchProgress, fetchTodoistUserId } from "@/lib/stats";
import { oauthConfigured } from "@/lib/oauth";

// Paste-a-token joining. Only used when Todoist sign-in isn't configured (e.g. local development),
// because a pasted personal token has full account access while sign-in grants read-only access.
export async function POST(req: Request) {
  if (oauthConfigured())
    return NextResponse.json({ error: "Use “Connect with Todoist” to join." }, { status: 400 });
  const notReady = storageReady();
  if (notReady) return NextResponse.json({ error: notReady }, { status: 500 });

  const { name, token, code } = await req.json().catch(() => ({}));
  const cleanName = String(name ?? "").trim().slice(0, 40);
  const cleanToken = String(token ?? "").trim();
  if (process.env.JOIN_CODE && code !== process.env.JOIN_CODE)
    return NextResponse.json({ error: "Wrong join code." }, { status: 403 });
  if (!cleanName || !cleanToken)
    return NextResponse.json({ error: "Name and token are both required." }, { status: 400 });

  let todoistUserId: string;
  try {
    await fetchProgress(cleanToken);
    todoistUserId = await fetchTodoistUserId(cleanToken);
  } catch {
    return NextResponse.json({ error: "That Todoist token didn't work." }, { status: 400 });
  }
  await upsertMember({ name: cleanName, token: cleanToken, todoistUserId });
  return NextResponse.json({ ok: true });
}
