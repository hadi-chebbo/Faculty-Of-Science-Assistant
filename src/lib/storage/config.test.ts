import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseStorageConfig } from "./config";

describe("parseStorageConfig", () => {
  it("defaults to the local driver and .storage", () => {
    expect(parseStorageConfig({})).toEqual({ driver: "local", localDir: path.resolve(".storage") });
  });

  it("uses STORAGE_LOCAL_DIR when set", () => {
    expect(parseStorageConfig({ STORAGE_LOCAL_DIR: "/tmp/x" }).localDir).toBe(path.resolve("/tmp/x"));
  });

  it("defaults to r2 on Vercel", () => {
    expect(parseStorageConfig({ VERCEL: "1" }).driver).toBe("r2");
  });

  it("refuses the local driver on Vercel", () => {
    expect(() => parseStorageConfig({ VERCEL: "1", STORAGE_DRIVER: "local" })).toThrow(/Vercel/);
  });

  it("rejects an unknown driver, naming the variable only", () => {
    expect(() => parseStorageConfig({ STORAGE_DRIVER: "s3-secret" })).toThrow(/STORAGE_DRIVER/);
    expect(() => parseStorageConfig({ STORAGE_DRIVER: "s3-secret" })).not.toThrow(/s3-secret/);
  });
});

describe("getStorage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("can be imported with no environment", async () => {
    vi.stubEnv("STORAGE_DRIVER", "");
    await expect(import("./config")).resolves.toBeDefined();
  });

  it("throws for the r2 driver, which is not built yet", async () => {
    vi.stubEnv("STORAGE_DRIVER", "r2");
    const { getStorage } = await import("./config");
    expect(() => getStorage()).toThrow("The R2 storage driver is not available yet");
  });
});
