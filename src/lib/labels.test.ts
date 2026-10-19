import { describe, expect, it } from "vitest";
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TYPES } from "@/db/constants";
import {
  EXAM_SESSION_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_NAMES,
  RESOURCE_TYPE_LABELS,
  RESOURCE_TYPE_SINGULAR_LABELS,
  describeGroups,
  formatAcademicYear,
} from "./labels";

describe("describeGroups", () => {
  it("counts each type with the right singular or plural", () => {
    expect(
      describeGroups([
        { type: "lecture", resources: [1, 2, 3] },
        { type: "notes", resources: [1] },
        { type: "exercise", resources: [1, 2] },
      ]),
    ).toBe("3 lectures · 1 note · 2 exercises");
  });

  it("is empty when nothing is inside", () => {
    expect(describeGroups([])).toBe("");
    expect(describeGroups([{ type: "lecture", resources: [] }])).toBe("");
  });
});

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

describe("RESOURCE_TYPE_SINGULAR_LABELS", () => {
  it("has a singular label for every type, in the order of RESOURCE_TYPES", () => {
    expect(RESOURCE_TYPES.map((t) => RESOURCE_TYPE_SINGULAR_LABELS[t])).toEqual([
      "Lecture", "Notes", "Exercise", "Exam", "Solution", "Other",
    ]);
  });

  it("has a full name for every language", () => {
    expect(LANGUAGE_NAMES).toEqual({ en: "English", fr: "French" });
  });
});
