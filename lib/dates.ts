// Calendar math in each person's own Todoist timezone and week start.

/** YYYY-MM-DD for `instant` in the given IANA timezone. */
export function localDate(tz: string, instant: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10); // unknown timezone: fall back to UTC
  }
}

/** First day of the week containing `date`. startDay: 1 = Monday … 7 = Sunday (Todoist's convention). */
export function weekStart(date: string, startDay = 1): string {
  const d = new Date(date + "T00:00:00Z");
  const isoDow = ((d.getUTCDay() + 6) % 7) + 1; // Monday = 1 … Sunday = 7
  d.setUTCDate(d.getUTCDate() - ((isoDow - startDay + 7) % 7));
  return d.toISOString().slice(0, 10);
}
