// Reads a person's goals and current counts from Todoist. Called only at sign-in;
// the access token is used for these two requests and then discarded.
import { localDate, weekStart } from "./dates.ts";

export type DayItem = { date: string; total_completed: number };
export type RawStats = {
  days_items?: DayItem[];
  goals?: { daily_goal?: number; weekly_goal?: number };
};
export type TodoistUser = { id: string; tz: string; startDay: number };
export type Seed = {
  today: string; dayDone: number; weekStart: string; weekDone: number; dailyGoal: number; weeklyGoal: number;
};

/** Today's and this week's counts, computed in the person's own timezone and week start. */
export function toSeed(raw: RawStats, user: Pick<TodoistUser, "tz" | "startDay">, now = new Date()): Seed {
  const today = localDate(user.tz, now);
  const ws = weekStart(today, user.startDay);
  const days = raw.days_items ?? []; // last 7 days, which always covers the current week
  return {
    today,
    dayDone: days.find((d) => d.date === today)?.total_completed ?? 0,
    weekStart: ws,
    weekDone: days.filter((d) => d.date >= ws && d.date <= today).reduce((s, d) => s + d.total_completed, 0),
    dailyGoal: raw.goals?.daily_goal ?? 0,
    weeklyGoal: raw.goals?.weekly_goal ?? 0,
  };
}

async function get(path: string, token: string) {
  const res = await fetch(`https://api.todoist.com/api/v1/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Todoist responded ${res.status}`);
  return res.json();
}

export async function fetchUser(token: string): Promise<TodoistUser> {
  const u = await get("user", token);
  return { id: String(u.id), tz: u.tz_info?.timezone ?? "UTC", startDay: Number(u.start_day) || 1 };
}

export async function readOnce(token: string): Promise<{ user: TodoistUser; seed: Seed }> {
  const [user, raw] = await Promise.all([fetchUser(token), get("tasks/completed/stats", token) as Promise<RawStats>]);
  return { user, seed: toSeed(raw, user) };
}
