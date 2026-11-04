import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { oauthConfigured, STATE_COOKIE } from "@/lib/oauth";

// Sends the person to Todoist to approve read-only access (used once to read goals and counts).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const name = (params.get("name") ?? "").trim().slice(0, 40);
  const back = (error: string) => NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, req.url));

  if (!oauthConfigured()) return back("Todoist sign-in isn't set up on this server yet.");
  if (!name) return back("Enter your name first.");
  if (process.env.JOIN_CODE && params.get("code") !== process.env.JOIN_CODE) return back("Wrong join code.");

  const state = randomBytes(24).toString("hex");
  const authorize = new URL("https://todoist.com/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.TODOIST_CLIENT_ID!);
  authorize.searchParams.set("scope", "data:read");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, name }), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth", maxAge: 600,
  });
  return res;
}
