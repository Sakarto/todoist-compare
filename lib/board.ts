// What the board stores: each person's name, timezone, week start and goals, plus a
// counter per day and per week. No Todoist tokens are ever stored.
import { createHash } from "crypto";
import { run } from "./kv.ts";
import { localDate, weekStart } from "./dates.ts";
import type { Seed, TodoistUser } from "./stats.ts";

export type Profile = { uid: string; name: string; tz: string; startDay: number; dailyGoal: number; weeklyGoal: number };
export type BoardPerson = { id: string; name: string; day: { done: number; goal: number }; week: { done: number; goal: number } };

const MEMBERS = "tc:members";
const pKey = (uid: string) => `tc:p:${uid}`;
const dKey = (uid: string, date: string) => `tc:d:${uid}:${date}`;
const wKey = (uid: string, start: string) => `tc:w:${uid}:${start}`;
const DAY_TTL = 3 * 86400;
const WEEK_TTL = 10 * 86400;

/** Adds or refreshes a person using numbers read once at sign-in. */
export async function join(name: string, user: TodoistUser, seed: Seed) {
  const profile: Profile = {
    uid: user.id, name, tz: user.tz, startDay: user.startDay, dailyGoal: seed.dailyGoal, weeklyGoal: seed.weeklyGoal,
  };
  await run([
    ["SADD", MEMBERS, user.id],
    ["SET", pKey(user.id), JSON.stringify(profile)],
    ["SET", dKey(user.id, seed.today), seed.dayDone, "EX", DAY_TTL],
    ["SET", wKey(user.id, seed.weekStart), seed.weekDone, "EX", WEEK_TTL],
  ]);
}

export async function leave(uid: string): Promise<boolean> {
  const [, had] = await run([["SREM", MEMBERS, uid], ["DEL", pKey(uid)]]);
  return Number(had) === 1;
}

export async function getProfile(uid: string): Promise<Profile | null> {
  const [v] = await run([["GET", pKey(uid)]]);
  return v ? (JSON.parse(String(v)) as Profile) : null;
}

/** Applies one completion (+1) or un-completion (-1) at `when`, in the person's own calendar. */
export async function applyCompletion(p: Profile, delta: 1 | -1, when: Date) {
  const day = localDate(p.tz, when);
  const week = weekStart(day, p.startDay);
  const [d, w] = (await run([
    ["INCRBY", dKey(p.uid, day), delta],
    ["INCRBY", wKey(p.uid, week), delta],
    ["EXPIRE", dKey(p.uid, day), DAY_TTL],
    ["EXPIRE", wKey(p.uid, week), WEEK_TTL],
  ])) as number[];
  const fix: (string | number)[][] = [];
  if (d < 0) fix.push(["SET", dKey(p.uid, day), 0, "EX", DAY_TTL]);
  if (w < 0) fix.push(["SET", wKey(p.uid, week), 0, "EX", WEEK_TTL]);
  await run(fix);
}

export async function board(now = new Date()): Promise<BoardPerson[]> {
  const [uids] = (await run([["SMEMBERS", MEMBERS]])) as string[][];
  if (!uids?.length) return [];
  const profiles = (await run(uids.map((u) => ["GET", pKey(u)])))
    .filter(Boolean)
    .map((v) => JSON.parse(String(v)) as Profile);
  const keys = profiles.flatMap((p) => {
    const today = localDate(p.tz, now);
    return [["GET", dKey(p.uid, today)], ["GET", wKey(p.uid, weekStart(today, p.startDay))]];
  });
  const counts = await run(keys);
  return profiles
    .map((p, i) => ({
      id: createHash("sha256").update(p.uid).digest("hex").slice(0, 12), // don't expose Todoist IDs
      name: p.name,
      day: { done: Number(counts[2 * i] ?? 0), goal: p.dailyGoal },
      week: { done: Number(counts[2 * i + 1] ?? 0), goal: p.weeklyGoal },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function isMember(uid: string): Promise<boolean> {
  return (await getProfile(uid)) !== null;
}
