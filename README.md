# Todoist Compare

A blank screen that shows each friend's name above their Todoist progress, **done / goal**, for today or this week.

- Goals come straight from each person's Todoist (Settings → Productivity), so nobody sets anything up here.
- One API call per person: `GET /api/v1/tasks/completed/stats`.
- Tokens stay on the server. The page only ever receives names and counts.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # checks the day/week math against a real Todoist response
```

Locally, members are saved to `.data/members.json`.

## Deploy (free)

1. Import this repo at vercel.com/new.
2. In the project, open **Storage** and add **Upstash Redis** (free tier). It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. Optional: add an env var `JOIN_CODE` so only people you give the code to can join.
4. Redeploy and send friends the link.

## How joining works

Each person clicks **Join**, enters their name, and pastes their API token from Todoist → Settings → Integrations → Developer. The token is checked against Todoist before it's saved. **Leave** removes you (it needs your own token, so no one can remove someone else).
