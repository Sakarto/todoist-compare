// Member storage. In production, uses Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN).
// Locally, uses a JSON file. Tokens are always stored encrypted when a key is configured.
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { decrypt, encrypt, hasEncryptionKey, isEncrypted } from "./crypto.ts";

export type Member = { id: string; name: string; token: string; todoistUserId?: string };

const KEY = "todoist-compare:members";
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const auth = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = path.join(process.cwd(), ".data", "members.json");
export const usingRedis = Boolean(url && auth);

async function redis(cmd: (string | number)[]) {
  const res = await fetch(url!, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage error ${res.status}`);
  return (await res.json()).result;
}

async function readRaw(): Promise<Member[]> {
  if (usingRedis) {
    const v = await redis(["GET", KEY]);
    return v ? JSON.parse(v) : [];
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeRaw(members: Member[]): Promise<void> {
  const json = JSON.stringify(members);
  if (usingRedis) {
    await redis(["SET", KEY, json]);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, json);
}

// Production must never store a token in plain text.
export function storageReady(): string | null {
  if (usingRedis && !hasEncryptionKey()) return "The server is missing TOKEN_ENCRYPTION_KEY.";
  return null;
}

function seal(token: string): string {
  return hasEncryptionKey() ? encrypt(token) : token;
}

/** Members with decrypted tokens, for server-side use only. Re-encrypts any legacy plaintext. */
export async function getMembers(): Promise<Member[]> {
  const raw = await readRaw();
  if (hasEncryptionKey() && raw.some((m) => !isEncrypted(m.token))) {
    await writeRaw(raw.map((m) => ({ ...m, token: isEncrypted(m.token) ? m.token : encrypt(m.token) })));
  }
  return raw.map((m) => ({ ...m, token: decrypt(m.token) }));
}

export async function upsertMember(input: { name: string; token: string; todoistUserId?: string }) {
  const raw = await readRaw();
  const plain = raw.map((m) => ({ ...m, token: decrypt(m.token) }));
  const existing = plain.find(
    (m) => (input.todoistUserId && m.todoistUserId === input.todoistUserId) || m.token === input.token
  );
  if (existing) Object.assign(existing, input);
  else plain.push({ id: randomUUID(), ...input });
  await writeRaw(plain.map((m) => ({ ...m, token: seal(m.token) })));
}

/** Removes the member matching this Todoist account or token. Returns whether one was removed. */
export async function removeMember(match: { todoistUserId?: string; token?: string }): Promise<boolean> {
  const raw = await readRaw();
  const kept = raw.filter((m) => {
    if (match.todoistUserId && m.todoistUserId === match.todoistUserId) return false;
    if (match.token && decrypt(m.token) === match.token) return false;
    return true;
  });
  if (kept.length === raw.length) return false;
  await writeRaw(kept);
  return true;
}
