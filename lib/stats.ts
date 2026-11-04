// Reads a person's goals and current counts from Todoist. Called only at sign-in;
// the access token is used for these two requests and then discarded.
import { localDate, weekStart } from "./dates.ts";

export type DayItem = { date: string; total_completed: number; items?: { id: string; completed: number }[] };
export type RawStats = {
  days_items?: DayItem[];
  goals?: { daily_goal?: number; weekly_goal?: number };
};
export type TodoistUser = { id: string; tz: string; startDay: number };
export type Project = { id: string; name: string; parentId: string | null };
export type Seed = {
  today: string; dayDone: number; weekStart: string; weekDone: number; dailyGoal: number; weeklyGoal: number;
};

/** A day's count, leaving out excluded projects (Todoist breaks each day down by project). */
function countDay(d: DayItem, excluded: Set<string>): number {
  if (!excluded.size || !d.items) return d.total_completed;
  return d.items.filter((i) => !excluded.has(String(i.id))).reduce((s, i) => s + i.completed, 0);
}

/** Today's and this week's counts, computed in the person's own timezone and week start. */
export function toSeed(
  raw: RawStats, user: Pick<TodoistUser, "tz" | "startDay">, now = new Date(), excluded: Set<string> = new Set()
): Seed {
  const today = localDate(user.tz, now);
  const ws = weekStart(today, user.startDay);
  const days = raw.days_items ?? []; // last 7 days, which always covers the current week
  const today_ = days.find((d) => d.date === today);
  return {
    today,
    dayDone: today_ ? countDay(today_, excluded) : 0,
    weekStart: ws,
    weekDone: days.filter((d) => d.date >= ws && d.date <= today).reduce((s, d) => s + countDay(d, excluded), 0),
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

export async function fetchProjects(token: string): Promise<Project[]> {
  const out: Project[] = [];
  let cursor: string | null = null;
  do {
    const page: any = await get(`projects?limit=200${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, token);
    for (const p of page.results ?? []) {
      if (!p.is_archived) out.push({ id: String(p.id), name: String(p.name), parentId: p.parent_id ? String(p.parent_id) : null });
    }
    cursor = page.next_cursor ?? null;
  } while (cursor);
  return out;
}

/** Everything the board needs from Todoist, read once at sign-in. The token isn't kept. */
export async function readOnce(token: string) {
  const [user, raw, projects] = await Promise.all([
    fetchUser(token),
    get("tasks/completed/stats", token) as Promise<RawStats>,
    fetchProjects(token),
  ]);
  return { user, raw: { days_items: raw.days_items, goals: raw.goals } as RawStats, projects };
}

/** Unticking a project also leaves out its sub-projects. */
export function expandExcluded(excluded: string[], projects: Project[]): string[] {
  const out = new Set(excluded);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of projects) if (p.parentId && out.has(p.parentId) && !out.has(p.id)) { out.add(p.id); grew = true; }
  }
  return [...out];
}
