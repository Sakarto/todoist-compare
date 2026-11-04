# Todoist Compare

See how you and your friends are doing on your Todoist goals, side by side.

Todoist Compare is a minimal, members-only board: each person's name sits above their completed tasks and their goal, like **7 / 10**. Switch between **Day** and **Week** to see today's progress or this week's. A count turns green when that person hits their goal.

## Features

- **Day and week views** that track each person's own daily and weekly goals, in their own timezone
- **Zero setup for goals:** they come straight from each person's Todoist productivity settings
- **Members only:** you see everyone's progress while you're on the board; leave and your name disappears, and you'd need to join again to see anyone
- **No stored access keys:** Todoist sign-in is used once to read your goals and current counts, then discarded
- **Live updates:** Todoist notifies the board through webhooks whenever a member completes or un-completes a task
- **Optional join code** to keep the board limited to people you invite

## How it works

1. **Join.** You enter your name and sign in with Todoist (OAuth, read-only `data:read` scope). The app reads your goals and recent counts from `GET /api/v1/tasks/completed/stats`, plus your timezone and week start from `GET /api/v1/user`, then throws the token away. Your browser gets a signed cookie that marks you as a member.
2. **Stay updated.** Todoist sends a signed webhook for every `item:completed` and `item:uncompleted` event. The board verifies the HMAC signature, ignores duplicate deliveries and collaborators' actions in shared projects, and adjusts that person's day and week counters.
3. **Leave.** Your profile and counters are deleted and your browser is signed out.

Counts are stored per person per day and per week, so they reset automatically at midnight and at the start of each person's week. Changed your goals in Todoist? Join again to refresh them.

## Built with

- Next.js and React (TypeScript)
- Todoist API v1 with OAuth and webhooks
- Upstash Redis

## Development

```bash
npm install
npm run dev
npm test
```

The tests cover the calendar math, webhook signature checks, a simulated day of completions, and seeding from a real Todoist API response.
