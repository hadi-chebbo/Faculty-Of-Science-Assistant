import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("accepts a valid postgres URL and defaults DATABASE_SSL to false", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://u:p@localhost:5432/db" });
    expect(env.DATABASE_URL).toBe("postgres://u:p@localhost:5432/db");
    expect(env.DATABASE_SSL).toBe("false");
  });

  it("accepts the postgresql:// scheme", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgresql://u:p@host/db" })).not.toThrow();
  });

  it("rejects a missing DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a non-postgres URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "mysql://u:p@host/db" })).toThrow(/postgres/);
  });

  it("rejects an invalid DATABASE_SSL value", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgres://u:p@host/db", DATABASE_SSL: "yes" }),
    ).toThrow(/DATABASE_SSL/);
  });

  it("never includes the secret value in the error message", () => {
    const secret = "super-secret-password";
    try {
      parseEnv({ DATABASE_URL: `mysql://u:${secret}@host/db` });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
