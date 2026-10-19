import path from "node:path";
import { z } from "zod";
import { createLocalStorage } from "./local";
import { createR2Storage, type R2Config } from "./r2";
import type { FileStorage } from "./types";

// Kept apart from env.ts on purpose, like auth-env.ts: nothing here runs at import time, so
// `next build` and the public pages work without any storage configuration.
const storageEnvSchema = z.object({
  STORAGE_DRIVER: z.enum(["local", "r2"]).optional(),
  STORAGE_LOCAL_DIR: z.string().min(1).optional(),
  VERCEL: z.string().optional(),
});

// Required only when the driver is r2.
const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

export type StorageConfig = { driver: "local" | "r2"; localDir: string; r2?: R2Config };

export function parseStorageConfig(source: Record<string, string | undefined>): StorageConfig {
  // Empty strings count as unset.
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([name, value]) => [name, value === "" ? undefined : value]),
  );
  const result = storageEnvSchema.safeParse(cleaned);
  if (!result.success) {
    // Variable names and rules only, never values.
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid storage configuration: ${problems}`);
  }
  const env = result.data;
  const onVercel = Boolean(env.VERCEL);
  const driver = env.STORAGE_DRIVER ?? (onVercel ? "r2" : "local");
  if (driver === "local" && onVercel) {
    throw new Error("STORAGE_DRIVER=local cannot be used on Vercel: a function has no durable disk. Use r2.");
  }
  let r2: R2Config | undefined;
  if (driver === "r2") {
    const r2Result = r2EnvSchema.safeParse(cleaned);
    if (!r2Result.success) {
      // Variable names only, never values.
      const names = r2Result.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Invalid storage configuration: STORAGE_DRIVER=r2 needs ${names}`);
    }
    const v = r2Result.data;
    r2 = { accountId: v.R2_ACCOUNT_ID, bucket: v.R2_BUCKET, accessKeyId: v.R2_ACCESS_KEY_ID, secretAccessKey: v.R2_SECRET_ACCESS_KEY };
  }
  // The folder is chosen at run time and only the local driver reads it, so the bundler is told
  // not to trace the whole project into the route because of this path.
  return {
    driver,
    localDir: path.resolve(/*turbopackIgnore: true*/ env.STORAGE_LOCAL_DIR ?? ".storage"),
    ...(r2 && { r2 }),
  };
}

export function getStorageConfig(): StorageConfig {
  return parseStorageConfig(process.env);
}

let cached: FileStorage | undefined;

// Built once. Nothing calls this at import time.
export function getStorage(): FileStorage {
  if (cached) return cached;
  const config = getStorageConfig();
  cached = config.r2 ? createR2Storage(config.r2) : createLocalStorage(config.localDir);
  return cached;
}
