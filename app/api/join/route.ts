import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getMembers, saveMembers } from "@/lib/store";
import { fetchProgress } from "@/lib/stats";

export async function POST(req: Request) {
  const { name, token, code } = await req.json().catch(() => ({}));
  const cleanName = String(name ?? "").trim().slice(0, 40);
  const cleanToken = String(token ?? "").trim();
  if (process.env.JOIN_CODE && code !== process.env.JOIN_CODE)
    return NextResponse.json({ error: "Wrong join code." }, { status: 403 });
  if (!cleanName || !cleanToken)
    return NextResponse.json({ error: "Name and token are both required." }, { status: 400 });

  // Check the token actually works before saving it.
  try {
    await fetchProgress(cleanToken);
  } catch {
    return NextResponse.json({ error: "That Todoist token didn't work." }, { status: 400 });
  }

  const members = await getMembers();
  const existing = members.find((m) => m.token === cleanToken);
  if (existing) existing.name = cleanName;
  else members.push({ id: randomUUID(), name: cleanName, token: cleanToken });
  await saveMembers(members);
  return NextResponse.json({ ok: true });
}
