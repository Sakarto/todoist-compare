# Todoist Compare

See how you and your friends are doing on your Todoist goals, side by side.

Todoist Compare is a minimal board: each person's name sits above their completed tasks and their goal, like **7 / 10**. Switch between **Day** and **Week** to see today's progress or this week's. A count turns green when that person hits their goal.

## Features

- **Day and week views** that track each person's own daily and weekly goals
- **Zero setup for goals:** they come straight from each person's Todoist productivity settings
- **Private by design:** API tokens stay on the server, and the page only ever shows names and counts
- **Live updates:** the board refreshes every minute
- **Join and leave anytime:** leaving requires your own token, so no one can remove anyone else
- **Optional join code** to keep the board limited to people you invite

## How it works

Each person joins with their name and a Todoist API token (Todoist → Settings → Integrations → Developer). The token is checked against Todoist before it's saved.

For every member, the server calls Todoist's productivity stats endpoint (`GET /api/v1/tasks/completed/stats`), which returns their goals and recent daily and weekly completion counts. "Today" is the newest day in each person's own timezone. The week total uses Todoist's weekly bucket when available and otherwise adds up the days since Monday.

## Built with

- Next.js and React (TypeScript)
- Todoist API v1
- Upstash Redis for storing members

## Development

```bash
npm install
npm run dev
npm test
```

The tests check the day and week math against a real Todoist API response.
