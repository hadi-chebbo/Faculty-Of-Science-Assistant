import { describe, expect, it } from "vitest";
import { parseUsersParams, usersHref } from "./params";

describe("users params", () => {
  it("reads q, status and page", () => {
    expect(parseUsersParams({ q: " bob ", status: "unconfirmed", page: "3" })).toEqual({ q: "bob", status: "unconfirmed", page: 3 });
    expect(parseUsersParams({ status: "blocked" }).status).toBe("blocked");
    expect(parseUsersParams({ q: ["a", "b"] }).q).toBe("a");
  });

  it("drops unusable values", () => {
    expect(parseUsersParams({ q: "   ", status: "deleted", page: "0" })).toEqual({ q: undefined, status: undefined, page: 1 });
    expect(parseUsersParams({ q: "x".repeat(300), page: "abc" })).toEqual({ q: undefined, status: undefined, page: 1 });
    expect(parseUsersParams({ page: "99999" }).page).toBe(1);
    expect(parseUsersParams({})).toEqual({ q: undefined, status: undefined, page: 1 });
  });

  it("writes the filters back, leaving out defaults", () => {
    expect(usersHref({ page: 1 })).toBe("/admin/users");
    expect(usersHref({ q: "a b&c", status: "unconfirmed", page: 2 })).toBe("/admin/users?q=a+b%26c&status=unconfirmed&page=2");
    expect(usersHref({ status: "blocked", page: 1 })).toBe("/admin/users?status=blocked");
  });
});
