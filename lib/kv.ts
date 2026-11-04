// Tiny key-value layer: Upstash Redis in production (KV_REST_API_URL / KV_REST_API_TOKEN),
// a JSON file locally. Only the handful of commands this app uses.
import { promises as fs } from "fs";
import path from "path";

type Cmd = (string | number)[];
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const auth = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const usingRedis = Boolean(url && auth);

/** Runs commands in order and returns their results. */
export async function run(cmds: Cmd[]): Promise<unknown[]> {
  if (!cmds.length) return [];
  if (usingRedis) {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Storage error ${res.status}`);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    return out.map((r) => {
      if (r.error) throw new Error(r.error);
      return r.result;
    });
  }
  return local(cmds);
}

// ---- local file fallback (development only) ----
const FILE = path.join(process.cwd(), ".data", "kv.json");
type Entry = { v: string | string[]; exp?: number };

async function local(cmds: Cmd[]): Promise<unknown[]> {
  let db: Record<string, Entry> = {};
  try { db = JSON.parse(await fs.readFile(FILE, "utf8")); } catch {}
  const now = Date.now();
  for (const k of Object.keys(db)) if (db[k].exp && db[k].exp! <= now) delete db[k];

  const out = cmds.map(([op, key, ...args]) => {
    const k = String(key);
    switch (String(op).toUpperCase()) {
      case "GET": return typeof db[k]?.v === "string" ? db[k].v : null;
      case "SET": {
        const nx = args.map(String).includes("NX");
        if (nx && db[k]) return null;
        const exIdx = args.map(String).indexOf("EX");
        db[k] = { v: String(args[0]), exp: exIdx >= 0 ? now + Number(args[exIdx + 1]) * 1000 : undefined };
        return "OK";
      }
      case "INCRBY": {
        const n = Number(db[k]?.v ?? 0) + Number(args[0]);
        db[k] = { v: String(n), exp: db[k]?.exp };
        return n;
      }
      case "EXPIRE": if (db[k]) db[k].exp = now + Number(args[0]) * 1000; return db[k] ? 1 : 0;
      case "DEL": { const had = k in db; delete db[k]; return had ? 1 : 0; }
      case "SADD": {
        const s = new Set(Array.isArray(db[k]?.v) ? (db[k].v as string[]) : []);
        args.forEach((a) => s.add(String(a)));
        db[k] = { v: [...s] };
        return s.size;
      }
      case "SREM": {
        const s = new Set(Array.isArray(db[k]?.v) ? (db[k].v as string[]) : []);
        args.forEach((a) => s.delete(String(a)));
        db[k] = { v: [...s] };
        return s.size;
      }
      case "SMEMBERS": return Array.isArray(db[k]?.v) ? db[k].v : [];
      default: throw new Error(`Unsupported command ${op}`);
    }
  });
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db));
  return out;
}
