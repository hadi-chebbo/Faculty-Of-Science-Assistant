import { describe, expect, it } from "vitest";
import { adminHref, parseAdminParams } from "./params";

describe("admin params", () => {
  it("reads the text filter and ignores unusable values", () => {
    expect(parseAdminParams({ text: "scanned" }).text).toBe("scanned");
    expect(parseAdminParams({ text: "all" }).text).toBeUndefined();
    expect(parseAdminParams({ text: ["scanned", "x"] }).text).toBe("scanned");
    expect(parseAdminParams({}).text).toBeUndefined();
  });

  it("writes the filters back into the address", () => {
    expect(adminHref({ course: "DEMO301", text: "scanned", page: 2 })).toBe("/admin?course=DEMO301&text=scanned&page=2");
    expect(adminHref({ page: 1 })).toBe("/admin");
  });
});
