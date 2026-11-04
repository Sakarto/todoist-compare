import { NextResponse, type NextRequest } from "next/server";
import { board, isMember } from "@/lib/board";
import { migrateLegacy } from "@/lib/migrate";
import { oauthConfigured } from "@/lib/oauth";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

// Members only: you see the board (names and counts) only while you're on it yourself.
export async function GET(req: NextRequest) {
  await migrateLegacy().catch(() => {});
  const settings = { oauth: oauthConfigured(), joinCode: Boolean(process.env.JOIN_CODE) };
  const uid = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !(await isMember(uid))) {
    const res = NextResponse.json({ joined: false, people: [], ...settings });
    if (uid) res.cookies.delete(SESSION_COOKIE); // stale cookie from someone who left
    return res;
  }
  return NextResponse.json({ joined: true, people: await board(), ...settings });
}
