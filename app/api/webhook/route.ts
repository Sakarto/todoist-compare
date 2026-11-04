import { NextResponse, type NextRequest } from "next/server";
import { verifySignature, toCompletion } from "@/lib/webhook";
import { applyCompletion, getProfile } from "@/lib/board";
import { run } from "@/lib/kv";
import { readSession, SESSION_COOKIE } from "@/lib/session";

const LOG = "tc:webhook-log";

/** Keeps the last 25 deliveries and what happened to each, for troubleshooting. No task contents. */
async function record(entry: Record<string, unknown>) {
  await run([
    ["LPUSH", LOG, JSON.stringify({ at: new Date().toISOString(), ...entry })],
    ["LTRIM", LOG, 0, 24],
    ["EXPIRE", LOG, 7 * 86400],
  ]).catch(() => {});
}

// Todoist calls this each time a signed-in member completes or un-completes a task.
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifySignature(raw, req.headers.get("x-todoist-hmac-sha256"), [
    process.env.TODOIST_CLIENT_SECRET,
    process.env.TODOIST_VERIFICATION_TOKEN,
  ]);
  if (!ok) {
    await record({ outcome: "rejected: signature didn't match", signed: Boolean(req.headers.get("x-todoist-hmac-sha256")) });
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch {
    await record({ outcome: "ignored: body wasn't JSON" });
    return NextResponse.json({ ok: true });
  }
  const event = String(payload?.event_name ?? "unknown");
  const recurring = Boolean(payload?.event_data?.due?.is_recurring);

  // Todoist retries deliveries; count each one only once.
  const delivery = req.headers.get("x-todoist-delivery-id");
  if (delivery) {
    const [fresh] = await run([["SET", `tc:dlv:${delivery}`, 1, "NX", "EX", 86400]]);
    if (fresh === null) {
      await record({ event, outcome: "ignored: duplicate delivery" });
      return NextResponse.json({ ok: true, duplicate: true });
    }
  }

  const c = toCompletion(payload);
  let outcome: string;
  if (!c) {
    outcome = event.startsWith("item:completed") || event.startsWith("item:uncompleted")
      ? "ignored: done by a collaborator, not this person"
      : "ignored: not a completion event";
  } else {
    const profile = await getProfile(c.uid);
    if (!profile) outcome = "ignored: this Todoist account isn't on the board";
    else if (c.projectId && profile.excluded?.includes(c.projectId)) outcome = `ignored: project not counted (${profile.name})`;
    else {
      await applyCompletion(profile, c.delta, c.when, c.projectId);
      outcome = `counted ${c.delta > 0 ? "+1" : "-1"} for ${profile.name}`;
    }
  }
  await record({ event, recurring, outcome });
  console.log(`webhook ${event}${recurring ? " (recurring)" : ""}: ${outcome}`);
  return NextResponse.json({ ok: true });
}

// Members can open /api/webhook to see recent deliveries.
export async function GET(req: NextRequest) {
  const uid = readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !(await getProfile(uid))) return NextResponse.json({ error: "Join the board to see this." }, { status: 403 });
  const [items] = (await run([["LRANGE", LOG, 0, 24]])) as string[][];
  const deliveries = (items ?? []).map((s) => JSON.parse(s));
  return NextResponse.json({
    summary: deliveries.length
      ? `${deliveries.length} recent notification(s) from Todoist, newest first.`
      : "No notifications have reached the app from Todoist yet.",
    deliveries,
  });
}
