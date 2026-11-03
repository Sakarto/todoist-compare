import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { oauthConfigured, STATE_COOKIE } from "@/lib/oauth";
import { storageReady } from "@/lib/store";

// Sends the person to Todoist to approve read-only access.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const intent = params.get("intent") === "leave" ? "leave" : "join";
  const name = (params.get("name") ?? "").trim().slice(0, 40);
  const back = (error: string) => NextResponse.redirect(new URL(`/?error=${encodeURIComponent(error)}`, req.url));

  if (!oauthConfigured()) return back("Todoist sign-in isn't set up on this server yet.");
  const notReady = storageReady();
  if (notReady) return back(notReady);
  if (intent === "join") {
    if (!name) return back("Enter your name first.");
    if (process.env.JOIN_CODE && params.get("code") !== process.env.JOIN_CODE) return back("Wrong join code.");
  }

  const state = randomBytes(24).toString("hex");
  const authorize = new URL("https://todoist.com/oauth/authorize");
  authorize.searchParams.set("client_id", process.env.TODOIST_CLIENT_ID!);
  authorize.searchParams.set("scope", "data:read");
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, intent, name }), {
    httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth", maxAge: 600,
  });
  return res;
}
