import { NextResponse } from "next/server";
import { verifySignature, toCompletion } from "@/lib/webhook";
import { applyCompletion, getProfile } from "@/lib/board";
import { run } from "@/lib/kv";

// Todoist calls this each time a signed-in member completes or un-completes a task.
export async function POST(req: Request) {
  const raw = await req.text();
  const ok = verifySignature(raw, req.headers.get("x-todoist-hmac-sha256"), [
    process.env.TODOIST_CLIENT_SECRET,
    process.env.TODOIST_VERIFICATION_TOKEN,
  ]);
  if (!ok) return NextResponse.json({ error: "bad signature" }, { status: 401 });

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }

  // Todoist retries deliveries; count each one only once.
  const delivery = req.headers.get("x-todoist-delivery-id");
  if (delivery) {
    const [fresh] = await run([["SET", `tc:dlv:${delivery}`, 1, "NX", "EX", 86400]]);
    if (fresh === null) return NextResponse.json({ ok: true, duplicate: true });
  }

  const recurring = Boolean(payload?.event_data?.due?.is_recurring);
  console.log(`webhook ${payload?.event_name}${recurring ? " (recurring task)" : ""}`);

  const c = toCompletion(payload);
  if (c) {
    const profile = await getProfile(c.uid);
    if (profile) await applyCompletion(profile, c.delta, c.when);
  }
  return NextResponse.json({ ok: true });
}
