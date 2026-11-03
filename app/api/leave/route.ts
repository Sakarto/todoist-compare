import { NextResponse } from "next/server";
import { removeMember } from "@/lib/store";

// Removing yourself requires your own token, so nobody can remove someone else.
// (With Todoist sign-in enabled, leaving goes through /api/auth/start?intent=leave instead.)
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  const t = String(token ?? "").trim();
  if (!t || !(await removeMember({ token: t })))
    return NextResponse.json({ error: "No one on the board uses that token." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
