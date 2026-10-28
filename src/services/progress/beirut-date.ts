// Active days are Beirut calendar days. These helpers turn an instant into a "YYYY-MM-DD" date
// in Asia/Beirut (daylight saving included) and into the Monday that starts its week.

const BEIRUT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut", year: "numeric", month: "2-digit", day: "2-digit" });

export function beirutDate(instant: Date): string {
  const parts = Object.fromEntries(BEIRUT.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// Adds whole days to a "YYYY-MM-DD" date (calendar arithmetic, no time zone involved).
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function beirutWeekStart(instant: Date): string {
  const today = beirutDate(instant);
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(today, -((weekday + 6) % 7));
}
