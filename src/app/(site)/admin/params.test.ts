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

describe("admin lecturer param", () => {
  it("reads a slug, ignores unusable values and keeps it in paging links", () => {
    expect(parseAdminParams({ lecturer: "ada-example" }).lecturer).toBe("ada-example");
    expect(parseAdminParams({ lecturer: "Not A Slug!" }).lecturer).toBeUndefined();
    expect(parseAdminParams({ lecturer: "" }).lecturer).toBeUndefined();
    expect(adminHref({ lecturer: "ada-example", page: 2 })).toBe("/admin?lecturer=ada-example&page=2");
  });
});
