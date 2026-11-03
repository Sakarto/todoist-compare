import { NextResponse, type NextRequest } from "next/server";
import { STATE_COOKIE } from "@/lib/oauth";
import { removeMember, upsertMember } from "@/lib/store";
import { fetchProgress, fetchTodoistUserId } from "@/lib/stats";

// Todoist sends the person back here after they approve (or decline).
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const finish = (query: string) => {
    const res = NextResponse.redirect(new URL(`/?${query}`, req.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth" });
    return res;
  };
  const fail = (msg: string) => finish(`error=${encodeURIComponent(msg)}`);

  let saved: { state?: string; intent?: string; name?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(STATE_COOKIE)?.value ?? "{}");
  } catch {}

  if (params.get("error")) return fail("Todoist access wasn't approved.");
  if (!saved.state || params.get("state") !== saved.state) return fail("Sign-in expired or didn't match. Try again.");
  const code = params.get("code");
  if (!code) return fail("Todoist didn't send a sign-in code.");

  let token: string;
  try {
    const tokenRes = await fetch("https://todoist.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.TODOIST_CLIENT_ID!,
        client_secret: process.env.TODOIST_CLIENT_SECRET!,
        code,
      }),
    });
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) return fail("Couldn't finish connecting to Todoist.");
    token = tokenJson.access_token;
  } catch {
    return fail("Couldn't reach Todoist. Try again in a moment.");
  }

  try {
    const todoistUserId = await fetchTodoistUserId(token);
    if (saved.intent === "leave") {
      const removed = await removeMember({ todoistUserId });
      return removed ? finish("left=1") : fail("You weren't on the board.");
    }
    await fetchProgress(token); // make sure stats are readable before saving
    await upsertMember({ name: saved.name || "Friend", token, todoistUserId });
    return finish("joined=1");
  } catch {
    return fail("Connected, but couldn't read your Todoist stats.");
  }
}
