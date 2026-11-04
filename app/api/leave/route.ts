import { NextResponse, type NextRequest } from "next/server";
import { leave } from "@/lib/board";
import { readSession, SESSION_COOKIE } from "@/lib/session";

// Leaving removes your name from the board and signs this browser out.
export async function POST(req: NextRequest) {
  const uid = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (uid) await leave(uid);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
