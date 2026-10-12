import { describe, expect, it } from "vitest";
import { parseAuthEnv } from "./auth-env";

describe("parseAuthEnv", () => {
  it("accepts a secret of at least 32 characters", () => {
    const secret = "x".repeat(32);
    expect(parseAuthEnv({ AUTH_SECRET: secret }).AUTH_SECRET).toBe(secret);
  });

  it("rejects a missing secret", () => {
    expect(() => parseAuthEnv({})).toThrow(/AUTH_SECRET/);
  });

  it("rejects an empty secret", () => {
    expect(() => parseAuthEnv({ AUTH_SECRET: "" })).toThrow(/AUTH_SECRET is required/);
  });

  it("rejects a short secret without echoing it", () => {
    const secret = "short-but-secret";
    try {
      parseAuthEnv({ AUTH_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/at least 32/);
      expect(String(error)).not.toContain(secret);
    }
  });
});
