// End-to-end over the real storage code (local file backend) with a simulated day.
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join, leave, board, applyCompletion, getProfile } from "../lib/board.ts";
import { run } from "../lib/kv.ts";

await fs.rm(".data", { recursive: true, force: true });
const avy = { id: "52738717", tz: "America/Los_Angeles", startDay: 1 };
const seed = { today: "2026-11-03", dayDone: 0, weekStart: "2026-11-02", weekDone: 8, dailyGoal: 5, weeklyGoal: 25 };
const tue = new Date("2026-11-03T20:00:00Z"); // Tue noon in LA

await join("Avy", avy, seed);
let [me] = await board(tue);
assert.deepEqual([me.name, me.day, me.week], ["Avy", { done: 0, goal: 5 }, { done: 8, goal: 25 }]);

const p = (await getProfile(avy.id))!;
for (let i = 0; i < 3; i++) await applyCompletion(p, 1, tue);
await applyCompletion(p, -1, tue);
[me] = await board(tue);
assert.deepEqual([me.day.done, me.week.done], [2, 10], "3 done, 1 undone");

// Midnight in LA: day resets, week carries on.
const wed = new Date("2026-11-04T09:00:00Z"); // Wed 1am LA
[me] = await board(wed);
assert.deepEqual([me.day.done, me.week.done], [0, 10], "new day starts at 0, week keeps going");
await applyCompletion(p, 1, wed);
[me] = await board(wed);
assert.deepEqual([me.day.done, me.week.done], [1, 11]);

// Undo can't push a count below zero.
await applyCompletion(p, -1, wed); await applyCompletion(p, -1, wed);
[me] = await board(wed);
assert.equal(me.day.done, 0);

// New week (Monday Nov 9 in LA) starts at 0.
[me] = await board(new Date("2026-11-09T18:00:00Z"));
assert.deepEqual([me.day.done, me.week.done], [0, 0]);

// Completions in a project the person left out don't count.
await join("Avy", avy, seed, ["chores"]);
const p2 = (await getProfile(avy.id))!;
const thu = new Date("2026-11-05T20:00:00Z");
await applyCompletion(p2, 1, thu, "chores");
await applyCompletion(p2, 1, thu, "work");
await applyCompletion(p2, 1, thu); // no project info: counted
[me] = await board(thu);
assert.equal(me.day.done, 2, "chores completion ignored");

// No tokens anywhere in storage.
const stored = await fs.readFile(".data/kv.json", "utf8");
assert.ok(!/token/i.test(stored), "storage holds no tokens");

assert.equal(await leave(avy.id), true);
assert.equal((await board(tue)).length, 0);
assert.equal(await leave(avy.id), false, "leaving twice reports not on board");

// Duplicate delivery guard behaves like Redis SET NX.
assert.equal((await run([["SET", "tc:dlv:x", 1, "NX", "EX", 60]]))[0], "OK");
assert.equal((await run([["SET", "tc:dlv:x", 1, "NX", "EX", 60]]))[0], null);

await fs.rm(".data", { recursive: true, force: true });
console.log("board tests passed");
