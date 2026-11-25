import { describe, expect, it } from "vitest";
import { RESOURCE_TYPES } from "@/db/constants";
import { TYPE_ICONS, TYPE_STYLES, YEAR_STYLES } from "./design-language";
import { YEARS } from "./years";

describe("year styles", () => {
  it("has a complete style for every year", () => {
    for (const year of YEARS) {
      const style = YEAR_STYLES[year];
      expect(style.solid, `solid ${year}`).toBeTruthy();
      expect(style.chip, `chip ${year}`).toBeTruthy();
      expect(style.border, `border ${year}`).toBeTruthy();
    }
  });

  it("gives every year its own colour", () => {
    const solids = YEARS.map((year) => YEAR_STYLES[year].solid);
    expect(new Set(solids).size).toBe(YEARS.length);
  });
});

describe("file-type styles", () => {
  it("has a chip style for every resource type", () => {
    for (const type of RESOURCE_TYPES) expect(TYPE_STYLES[type].chip, type).toBeTruthy();
  });

  it("has an icon for every resource type, and the icons are the ones the rows use", () => {
    for (const type of RESOURCE_TYPES) {
      expect(TYPE_STYLES[type].icon, type).toBeTruthy();
      expect(TYPE_ICONS[type], type).toBe(TYPE_STYLES[type].icon);
    }
  });

  it("gives lectures, notes, exercises and exams their own colour, and keeps solutions and other neutral", () => {
    const coloured = (["lecture", "notes", "exercise", "exam"] as const).map((type) => TYPE_STYLES[type].chip);
    expect(new Set(coloured).size).toBe(4);
    expect(TYPE_STYLES.solution.chip).toBe(TYPE_STYLES.other.chip);
    expect(coloured).not.toContain(TYPE_STYLES.other.chip);
  });
});
