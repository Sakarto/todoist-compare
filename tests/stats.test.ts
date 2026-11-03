// Fixture is a real Todoist stats response (shape preserved, newest-first ordering included).
import assert from "node:assert/strict";
import { toProgress } from "../lib/stats.ts";

const real = {
  days_items: [
    { date: "2026-11-03", total_completed: 0 },
    { date: "2026-11-02", total_completed: 8 },
    { date: "2026-11-01", total_completed: 9 },
    { date: "2026-10-31", total_completed: 13 },
    { date: "2026-10-30", total_completed: 2 },
    { date: "2026-10-29", total_completed: 10 },
    { date: "2026-10-28", total_completed: 2 },
  ],
  week_items: [
    { from: "2026-11-02", to: "2026-11-08", total_completed: 8 },
    { from: "2026-10-26", to: "2026-11-01", total_completed: 40 },
  ],
  goals: { daily_goal: 5, weekly_goal: 25 },
};

const p = toProgress(real);
assert.equal(p.today, "2026-11-03");
assert.deepEqual(p.day, { done: 0, goal: 5 });
assert.deepEqual(p.week, { done: 8, goal: 25 });

// Account without week_items: summing days since Monday must give the same answer.
const noWeeks = toProgress({ ...real, week_items: undefined });
assert.deepEqual(noWeeks.week, { done: 8, goal: 25 });

// Sunday edge case: week runs Mon 10-26 .. Sun 11-01 = 2+10+2+13+9 = 36 (10-28..11-01 only, 7-day window)
const sunday = toProgress({ days_items: real.days_items.slice(2), goals: real.goals });
assert.equal(sunday.today, "2026-11-01");
assert.equal(sunday.week.done, 2 + 10 + 2 + 13 + 9);

console.log("all stats tests passed");
