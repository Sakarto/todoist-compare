import { NextResponse, type NextRequest } from "next/server";
import { deletePending, PENDING_COOKIE, readPending } from "@/lib/pending";
import { join } from "@/lib/board";
import { expandExcluded, toSeed } from "@/lib/stats";
import { makeSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

// GET: the project list to choose from. POST: save the choice and join the board.
export async function GET(req: NextRequest) {
  const p = await readPending(req.cookies.get(PENDING_COOKIE)?.value);
  if (!p) return NextResponse.json({ pending: false });
  return NextResponse.json({ pending: true, name: p.name, projects: p.projects, excluded: p.excluded });
}

export async function POST(req: NextRequest) {
  const id = req.cookies.get(PENDING_COOKIE)?.value;
  const p = await readPending(id);
  if (!p) return NextResponse.json({ error: "That took too long. Connect with Todoist again." }, { status: 410 });

  const body = await req.json().catch(() => ({}));
  const known = new Set(p.projects.map((x) => x.id));
  const picked = (Array.isArray(body.excluded) ? body.excluded : []).map(String).filter((x: string) => known.has(x));
  if (picked.length === p.projects.length)
    return NextResponse.json({ error: "Pick at least one project to count." }, { status: 400 });

  const excluded = expandExcluded(picked, p.projects);
  await join(p.name, p.user, toSeed(p.raw, p.user, new Date(), new Set(excluded)), excluded);
  await deletePending(id!);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSession(p.user.id), sessionCookieOptions);
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
