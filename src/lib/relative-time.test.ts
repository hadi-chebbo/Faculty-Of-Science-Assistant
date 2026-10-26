import { describe, expect, it } from "vitest";
import { relativeTime } from "./relative-time";

const NOW = new Date("2026-10-26T12:00:00Z");
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000).toISOString();

describe("relativeTime", () => {
  it("says just now under a minute, and for times slightly in the future", () => {
    expect(relativeTime(ago(0), NOW)).toBe("just now");
    expect(relativeTime(ago(59), NOW)).toBe("just now");
    expect(relativeTime(ago(-30), NOW)).toBe("just now");
  });

  it("counts minutes, hours and days", () => {
    expect(relativeTime(ago(60), NOW)).toBe("1 minute ago");
    expect(relativeTime(ago(5 * 60 + 20), NOW)).toBe("5 minutes ago");
    expect(relativeTime(ago(3600), NOW)).toBe("1 hour ago");
    expect(relativeTime(ago(23 * 3600), NOW)).toBe("23 hours ago");
    expect(relativeTime(ago(24 * 3600), NOW)).toBe("yesterday");
    expect(relativeTime(ago(3 * 24 * 3600), NOW)).toBe("3 days ago");
  });

  it("counts weeks, months and years", () => {
    expect(relativeTime(ago(7 * 24 * 3600), NOW)).toBe("last week");
    expect(relativeTime(ago(21 * 24 * 3600), NOW)).toBe("3 weeks ago");
    expect(relativeTime(ago(60 * 24 * 3600), NOW)).toBe("2 months ago");
    expect(relativeTime(ago(400 * 24 * 3600), NOW)).toBe("last year");
  });

  it("accepts dates and ISO strings alike", () => {
    expect(relativeTime(new Date(ago(2 * 3600)), NOW.toISOString())).toBe("2 hours ago");
  });
});
