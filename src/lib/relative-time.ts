// "5 minutes ago", "yesterday", "3 days ago": English, from a past time to a given "now". The
// caller passes `now`, so the server render and the first client render agree.
const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

export function relativeTime(from: Date | string | number, now: Date | string | number): string {
  const seconds = Math.round((new Date(now).getTime() - new Date(from).getTime()) / 1000);
  // Under a minute, and any clock difference that puts the time in the future.
  if (seconds < 60) return "just now";
  for (const [unit, size] of UNITS) {
    if (seconds >= size) return formatter.format(-Math.floor(seconds / size), unit);
  }
  return "just now";
}
