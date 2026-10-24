import { describe, expect, it } from "vitest";
import { academicYearOptions, formatSavedDate, previewWhere } from "./form-helpers";

describe("academicYearOptions", () => {
  it("lists 16 years, newest first, from the current year back 15", () => {
    const options = academicYearOptions(2026, null);
    expect(options).toHaveLength(16);
    expect(options[0]).toEqual({ value: "2026", label: "2026-2027" });
    expect(options[15]).toEqual({ value: "2011", label: "2011-2012" });
  });

  it("adds a stored year outside the range, in its place", () => {
    const older = academicYearOptions(2026, 2005);
    expect(older).toHaveLength(17);
    expect(older[16]).toEqual({ value: "2005", label: "2005-2006" });
    const newer = academicYearOptions(2026, 2030);
    expect(newer[0]).toEqual({ value: "2030", label: "2030-2031" });
  });

  it("does not repeat a stored year that is already listed", () => {
    expect(academicYearOptions(2026, 2024)).toHaveLength(16);
  });
});

describe("previewWhere", () => {
  it("names the chapter and the plural type for a chaptered resource", () => {
    expect(previewWhere("DEMO510", "lecture", 2)).toBe("In DEMO510 › Chapter 2 › Lectures");
  });
  it("uses Other material when there is no chapter", () => {
    expect(previewWhere("DEMO510", "exercise", null)).toBe("In DEMO510 › Other material › Exercises");
  });
  it("puts exams under Previous exams, chapter or not", () => {
    expect(previewWhere("DEMO510", "exam", 3)).toBe("In DEMO510 › Previous exams");
  });
  it("asks for a course when none is chosen", () => {
    expect(previewWhere("", "lecture", null)).toBe("Choose a course to see where it will appear.");
  });
});

describe("formatSavedDate", () => {
  it("prints day, short month and year in UTC", () => {
    expect(formatSavedDate("2026-10-12T23:30:00.000Z")).toBe("12 Oct 2026");
  });
});
