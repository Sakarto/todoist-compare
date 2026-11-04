import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { localDate, weekStart } from "../lib/dates.ts";
import { toSeed, expandExcluded } from "../lib/stats.ts";
import { verifySignature, toCompletion } from "../lib/webhook.ts";

// --- calendar math ---
// 2026-11-04 05:00 UTC is still Nov 3 in Los Angeles.
const t = new Date("2026-11-04T05:00:00Z");
assert.equal(localDate("America/Los_Angeles", t), "2026-11-03");
assert.equal(localDate("Asia/Kolkata", t), "2026-11-04");
assert.equal(localDate("Not/AZone", t), "2026-11-04", "bad timezone falls back to UTC");
assert.equal(weekStart("2026-11-03", 1), "2026-11-02", "Tuesday -> Monday");
assert.equal(weekStart("2026-11-02", 1), "2026-11-02", "Monday is its own start");
assert.equal(weekStart("2026-11-08", 1), "2026-11-02", "Sunday belongs to Monday's week");
assert.equal(weekStart("2026-11-03", 7), "2026-11-01", "Sunday-start weeks");
assert.equal(weekStart("2026-11-01", 7), "2026-11-01");

// --- seeding from a real Todoist stats response (Avy's, Nov 3 2026, newest-first) ---
const real = {
  days_items: [
    { date: "2026-11-03", total_completed: 0 }, { date: "2026-11-02", total_completed: 8 },
    { date: "2026-11-01", total_completed: 9 }, { date: "2026-10-31", total_completed: 13 },
    { date: "2026-10-30", total_completed: 2 }, { date: "2026-10-29", total_completed: 10 },
    { date: "2026-10-28", total_completed: 2 },
  ],
  goals: { daily_goal: 5, weekly_goal: 25 },
};
const la = { tz: "America/Los_Angeles", startDay: 1 };
assert.deepEqual(toSeed(real, la, new Date("2026-11-03T14:17:00Z")), {
  today: "2026-11-03", dayDone: 0, weekStart: "2026-11-02", weekDone: 8, dailyGoal: 5, weeklyGoal: 25,
}, "matches Todoist's own weekly bucket (8)");
const sundayStart = toSeed(real, { tz: "America/Los_Angeles", startDay: 7 }, new Date("2026-11-03T14:17:00Z"));
assert.equal(sundayStart.weekDone, 9 + 8 + 0, "Sunday-start week counts Sun+Mon+Tue");

// --- webhook signatures ---
const body = JSON.stringify({ event_name: "item:completed", user_id: "1" });
const sig = createHmac("sha256", "client-secret").update(body).digest("base64");
assert.ok(verifySignature(body, sig, ["client-secret"]));
assert.ok(verifySignature(body, sig, [undefined, "other", "client-secret"]), "any configured secret works");
assert.ok(!verifySignature(body, sig, ["wrong"]), "wrong secret rejected");
assert.ok(!verifySignature(body + " ", sig, ["client-secret"]), "tampered body rejected");
assert.ok(!verifySignature(body, null, ["client-secret"]), "missing signature rejected");
assert.ok(!verifySignature(body, "short", ["client-secret"]), "garbage signature rejected without throwing");

// --- interpreting events ---
const done = toCompletion({ event_name: "item:completed", user_id: "52738717", initiator: { id: "52738717" },
  event_data: { completed_at: "2026-11-04T06:30:00Z" } });
assert.deepEqual(done, { uid: "52738717", delta: 1, when: new Date("2026-11-04T06:30:00Z"), projectId: undefined });
assert.equal(toCompletion({ event_name: "item:completed", user_id: "1", initiator: { id: "2" } }), null,
  "a collaborator's completion isn't counted for you");
assert.equal(toCompletion({ event_name: "item:added", user_id: "1" }), null, "other events ignored");
assert.equal(toCompletion({ event_name: "item:uncompleted", user_id: "1" })?.delta, -1);
assert.equal(toCompletion({ event_name: "item:completed", user_id: 1 })?.uid, "1", "numeric ids normalized");

console.log("logic tests passed");

// --- member session cookie ---
import { makeSession, readSession } from "../lib/session.ts";
const cookie = makeSession("52738717", "k1");
assert.equal(readSession(cookie, "k1"), "52738717");
assert.equal(readSession(cookie, "k2"), null, "signed with a different secret");
assert.equal(readSession("99999." + cookie.split(".")[1], "k1"), null, "can't swap in someone else's ID");
assert.equal(readSession("52738717", "k1"), null, "unsigned rejected");
assert.equal(readSession(undefined, "k1"), null);
console.log("session tests passed");

// --- project filtering, using Avy's real per-project breakdown (Nov 2026) ---
const INBOX = "6XG8xJ3QCwGWpXmj", SCHOOL = "6hJc6mQh3Mqx6gjP", ECS = "6hJc86qhxJGCrcqX";
const byProject = {
  days_items: [
    { date: "2026-11-03", total_completed: 0, items: [] },
    { date: "2026-11-02", total_completed: 8, items: [{ id: INBOX, completed: 1 }, { id: SCHOOL, completed: 1 }, { id: ECS, completed: 6 }] },
    { date: "2026-11-01", total_completed: 9, items: [{ id: SCHOOL, completed: 9 }] },
  ],
  goals: { daily_goal: 5, weekly_goal: 25 },
};
const tue = new Date("2026-11-03T14:17:00Z");
assert.equal(toSeed(byProject, la, tue).weekDone, 8, "no filter = Todoist total");
assert.equal(toSeed(byProject, la, tue, new Set([INBOX])).weekDone, 7, "leaving out Inbox");
assert.equal(toSeed(byProject, la, tue, new Set([SCHOOL, INBOX])).weekDone, 6, "only ECs");
const monLA = new Date("2026-11-02T20:00:00Z");
assert.equal(toSeed(byProject, la, monLA, new Set([ECS])).dayDone, 2, "today, without ECs");

const projects = [
  { id: "home", name: "Home", parentId: null }, { id: "chores", name: "Chores", parentId: "home" },
  { id: "laundry", name: "Laundry", parentId: "chores" }, { id: "work", name: "Work", parentId: null },
];
assert.deepEqual(expandExcluded(["home"], projects).sort(), ["chores", "home", "laundry"], "sub-projects follow their parent");
assert.deepEqual(expandExcluded(["chores"], projects).sort(), ["chores", "laundry"]);
assert.deepEqual(expandExcluded([], projects), []);

assert.equal(toCompletion({ event_name: "item:completed", user_id: "1", event_data: { project_id: 42 } })?.projectId, "42");
console.log("project filter tests passed");
