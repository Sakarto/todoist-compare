// Turns Todoist's productivity stats into the two numbers we show per person.
// Validated against real API output: days_items arrives newest-first, so we sort by date.

export type DayItem = { date: string; total_completed: number };
export type WeekItem = { from: string; to: string; total_completed: number };
export type RawStats = {
  days_items?: DayItem[];
  week_items?: WeekItem[];
  goals?: { daily_goal?: number; weekly_goal?: number };
};

export type Progress = {
  day: { done: number; goal: number };
  week: { done: number; goal: number };
  today: string;
};

function mondayOf(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export function toProgress(raw: RawStats): Progress {
  const days = [...(raw.days_items ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  // The newest day in the response is "today" in that user's own timezone.
  const today = days.length ? days[days.length - 1].date : new Date().toISOString().slice(0, 10);
  const dayDone = days.find((d) => d.date === today)?.total_completed ?? 0;

  // Prefer Todoist's own weekly bucket; fall back to summing days since Monday.
  const week = (raw.week_items ?? []).find((w) => w.from <= today && today <= w.to);
  const monday = mondayOf(today);
  const weekDone = week
    ? week.total_completed
    : days.filter((d) => d.date >= monday && d.date <= today).reduce((s, d) => s + d.total_completed, 0);

  return {
    today,
    day: { done: dayDone, goal: raw.goals?.daily_goal ?? 0 },
    week: { done: weekDone, goal: raw.goals?.weekly_goal ?? 0 },
  };
}

export async function fetchProgress(token: string): Promise<Progress> {
  const res = await fetch("https://api.todoist.com/api/v1/tasks/completed/stats", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Todoist responded ${res.status}`);
  return toProgress((await res.json()) as RawStats);
}
