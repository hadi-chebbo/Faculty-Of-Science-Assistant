import { describe, expect, it } from "vitest";
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TYPES } from "@/db/constants";
import {
  EXAM_SESSION_LABELS,
  LANGUAGE_LABELS,
  RESOURCE_TYPE_LABELS,
  formatAcademicYear,
} from "./labels";

describe("formatAcademicYear", () => {
  it("shows the start year and the next one", () => {
    expect(formatAcademicYear(2024)).toBe("2024-2025");
    expect(formatAcademicYear(1999)).toBe("1999-2000");
  });
});

describe("labels", () => {
  it("cover every database value", () => {
    expect(Object.keys(RESOURCE_TYPE_LABELS).sort()).toEqual([...RESOURCE_TYPES].sort());
    expect(Object.keys(EXAM_SESSION_LABELS).sort()).toEqual([...EXAM_SESSIONS].sort());
    expect(Object.keys(LANGUAGE_LABELS).sort()).toEqual([...LANGUAGES].sort());
  });

  it("use the agreed wording", () => {
    expect(RESOURCE_TYPE_LABELS.exercise).toBe("Exercises");
    expect(EXAM_SESSION_LABELS.second).toBe("Second session");
  });
});
