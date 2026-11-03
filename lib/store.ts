// Member storage. On Vercel, uses Upstash Redis (set up in one click from the Vercel
// Marketplace; it injects KV_REST_API_URL / KV_REST_API_TOKEN). Locally, uses a JSON file.
import { promises as fs } from "fs";
import path from "path";

export type Member = { id: string; name: string; token: string };

const KEY = "todoist-compare:members";
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const auth = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = path.join(process.cwd(), ".data", "members.json");

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

export async function getMembers(): Promise<Member[]> {
  if (url && auth) {
    const v = await redis(["GET", KEY]);
    return v ? JSON.parse(v) : [];
  }
  try {
    return JSON.parse(await fs.readFile(FILE, "utf8"));
  } catch {
    return [];
  }
}

export async function saveMembers(members: Member[]): Promise<void> {
  const json = JSON.stringify(members);
  if (url && auth) {
    await redis(["SET", KEY, json]);
    return;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, json);
}
