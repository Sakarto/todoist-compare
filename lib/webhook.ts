// Verifies and interprets Todoist webhook deliveries.
import { createHmac, timingSafeEqual } from "crypto";

/** Todoist signs the raw body: base64(HMAC-SHA256(secret, body)). Accepts any of the given secrets. */
export function verifySignature(rawBody: string, signature: string | null, secrets: (string | undefined)[]): boolean {
  if (!signature) return false;
  const given = Buffer.from(signature);
  return secrets.some((s) => {
    if (!s) return false;
    const expected = Buffer.from(createHmac("sha256", s).update(rawBody).digest("base64"));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

export type Completion = { uid: string; delta: 1 | -1; when: Date; projectId?: string } | null;

/** Turns a webhook payload into a +1/-1 for the person who did it, or null to ignore. */
export function toCompletion(payload: any, now = new Date()): Completion {
  const name = payload?.event_name;
  if (name !== "item:completed" && name !== "item:uncompleted") return null;
  const uid = payload?.user_id != null ? String(payload.user_id) : "";
  if (!uid) return null;
  // In shared projects every collaborator gets the event; only count it for whoever did it.
  const initiator = payload?.initiator?.id;
  if (initiator != null && String(initiator) !== uid) return null;
  const stamp = name === "item:completed" ? payload?.event_data?.completed_at ?? payload?.triggered_at : payload?.triggered_at;
  const when = stamp ? new Date(stamp) : now;
  const projectId = payload?.event_data?.project_id != null ? String(payload.event_data.project_id) : undefined;
  return { uid, delta: name === "item:completed" ? 1 : -1, when: isNaN(when.getTime()) ? now : when, projectId };
}
