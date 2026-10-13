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
    const r2Vars = { R2_ACCOUNT_ID: "a", R2_BUCKET: "b", R2_ACCESS_KEY_ID: "c", R2_SECRET_ACCESS_KEY: "d" };
    expect(parseStorageConfig({ VERCEL: "1", ...r2Vars }).driver).toBe("r2");
  });

  it("refuses the local driver on Vercel", () => {
    expect(() => parseStorageConfig({ VERCEL: "1", STORAGE_DRIVER: "local" })).toThrow(/Vercel/);
  });

  it("rejects an unknown driver, naming the variable only", () => {
    expect(() => parseStorageConfig({ STORAGE_DRIVER: "s3-secret" })).toThrow(/STORAGE_DRIVER/);
    expect(() => parseStorageConfig({ STORAGE_DRIVER: "s3-secret" })).not.toThrow(/s3-secret/);
  });
});

describe("parseStorageConfig for r2", () => {
  const full = {
    STORAGE_DRIVER: "r2",
    R2_ACCOUNT_ID: "acct",
    R2_BUCKET: "bucket",
    R2_ACCESS_KEY_ID: "key-id",
    R2_SECRET_ACCESS_KEY: "super-secret-value",
  };

  it("returns the four settings", () => {
    expect(parseStorageConfig(full).r2).toEqual({
      accountId: "acct",
      bucket: "bucket",
      accessKeyId: "key-id",
      secretAccessKey: "super-secret-value",
    });
  });

  it.each(["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"])(
    "names %s when it is missing or empty, without any value",
    (name) => {
      for (const value of [undefined, ""]) {
        const source = { ...full, [name]: value };
        expect(() => parseStorageConfig(source)).toThrow(name);
        expect(() => parseStorageConfig(source)).not.toThrow(/super-secret-value|key-id/);
      }
    },
  );

  it("does not require them for the local driver", () => {
    expect(parseStorageConfig({ STORAGE_DRIVER: "local" }).r2).toBeUndefined();
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

  it("returns the r2 driver when the four variables are set", async () => {
    vi.stubEnv("STORAGE_DRIVER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "acct");
    vi.stubEnv("R2_BUCKET", "bucket");
    vi.stubEnv("R2_ACCESS_KEY_ID", "key-id");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-value");
    const { getStorage } = await import("./config");
    const storage = getStorage();
    expect(typeof storage.createReadUrl).toBe("function");
    expect(await storage.createReadUrl("a.pdf", { expiresInSeconds: 60, disposition: "inline" })).toContain(
      "acct.r2.cloudflarestorage.com/bucket/a.pdf",
    );
  });

  it("throws for the r2 driver without its variables", async () => {
    vi.stubEnv("STORAGE_DRIVER", "r2");
    vi.stubEnv("R2_ACCOUNT_ID", "");
    vi.stubEnv("R2_BUCKET", "");
    vi.stubEnv("R2_ACCESS_KEY_ID", "");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "");
    const { getStorage } = await import("./config");
    expect(() => getStorage()).toThrow(/R2_ACCOUNT_ID/);
  });
});
