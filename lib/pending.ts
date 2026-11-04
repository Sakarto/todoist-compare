// Holds what was read from Todoist at sign-in for up to 15 minutes while the person picks
// which projects count. Contains numbers and project names only, never the token.
import { randomBytes } from "crypto";
import { run } from "./kv.ts";
import { getProfile } from "./board.ts";
import type { Project, RawStats, TodoistUser } from "./stats.ts";

export const PENDING_COOKIE = "tc_pending";
const TTL = 15 * 60;
export type Pending = { name: string; user: TodoistUser; raw: RawStats; projects: Project[]; excluded: string[] };

export async function createPending(name: string, data: { user: TodoistUser; raw: RawStats; projects: Project[] }) {
  const existing = await getProfile(data.user.id); // rejoining: start from previous choices
  const pending: Pending = { name, ...data, excluded: existing?.excluded ?? [] };
  const id = randomBytes(24).toString("hex");
  await run([["SET", `tc:pend:${id}`, JSON.stringify(pending), "EX", TTL]]);
  return id;
}

export async function readPending(id: string | undefined): Promise<Pending | null> {
  if (!id || !/^[a-f0-9]{48}$/.test(id)) return null;
  const [v] = await run([["GET", `tc:pend:${id}`]]);
  return v ? (JSON.parse(String(v)) as Pending) : null;
}

export async function deletePending(id: string) {
  await run([["DEL", `tc:pend:${id}`]]);
}

export const pendingCookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: TTL };
