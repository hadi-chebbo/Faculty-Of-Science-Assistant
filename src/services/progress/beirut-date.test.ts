import { describe, expect, it } from "vitest";
import { beirutDate, beirutWeekStart } from "./beirut-date";

describe("beirutDate", () => {
  it("is already the next day at 23:30 UTC in winter (UTC+2)", () => {
    expect(beirutDate(new Date("2026-01-14T23:30:00Z"))).toBe("2026-01-15");
  });
  it("is the next day at 21:30 UTC in summer (UTC+3)", () => {
    expect(beirutDate(new Date("2026-07-14T21:30:00Z"))).toBe("2026-07-15");
  });
  it("stays the same day just before the Beirut midnight", () => {
    expect(beirutDate(new Date("2026-07-14T20:59:00Z"))).toBe("2026-07-14");
  });
});

describe("beirutWeekStart", () => {
  it("gives the Monday itself on a Monday", () => {
    expect(beirutWeekStart(new Date("2026-10-26T10:00:00Z"))).toBe("2026-10-26");
  });
  it("puts a Sunday late evening in the week that began the previous Monday", () => {
    // Sunday 2026-11-01 23:30 Beirut (UTC+2) = 21:30 UTC.
    expect(beirutWeekStart(new Date("2026-11-01T21:30:00Z"))).toBe("2026-10-26");
  });
  it("starts a new week at Monday 00:30 Beirut", () => {
    // Monday 2026-11-02 00:30 Beirut (UTC+2) = Sunday 22:30 UTC.
    expect(beirutWeekStart(new Date("2026-11-01T22:30:00Z"))).toBe("2026-11-02");
  });
  it("crosses month and year boundaries", () => {
    expect(beirutWeekStart(new Date("2026-01-01T10:00:00Z"))).toBe("2025-12-29");
  });
});
