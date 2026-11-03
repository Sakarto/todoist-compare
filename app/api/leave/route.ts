import { NextResponse } from "next/server";
import { getMembers, saveMembers } from "@/lib/store";

// Removing yourself requires your own token, so nobody can remove someone else.
export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({}));
  const members = await getMembers();
  const kept = members.filter((m) => m.token !== String(token ?? "").trim());
  if (kept.length === members.length)
    return NextResponse.json({ error: "No one on the board uses that token." }, { status: 404 });
  await saveMembers(kept);
  return NextResponse.json({ ok: true });
}
