export const oauthConfigured = () =>
  Boolean(process.env.TODOIST_CLIENT_ID && process.env.TODOIST_CLIENT_SECRET);

export const STATE_COOKIE = "tc_oauth";
