const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Beirut", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// "29 Oct 2026", Beirut time.
export const formatDate = (iso: string) => DATE.format(new Date(iso));

// "29 Oct 2026, 14:05", Beirut time.
export const formatDateTime = (iso: string) => `${formatDate(iso)}, ${TIME.format(new Date(iso))}`;
