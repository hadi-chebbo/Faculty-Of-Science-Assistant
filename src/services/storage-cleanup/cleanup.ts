import { Op } from "sequelize";
import { z } from "zod";
import { getDb } from "@/db/models";
import { getStorage } from "@/lib/storage/config";
import { requireCurrentAdmin } from "../auth/require-admin";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { ABANDONED_AFTER_HOURS, DELETE_KEYS_MAX, UPLOAD_KEY_PATTERN, UPLOAD_KEY_PREFIX } from "./constants";
import type { AbandonedFile, AbandonedUploads, DeleteResult } from "./types";

const deleteInputSchema = z.array(z.string().max(200)).min(1).max(DELETE_KEYS_MAX);

// Stored objects that fit the first two rules (generated key shape, old enough), oldest first.
async function oldUploads(now: Date): Promise<AbandonedFile[]> {
  const cutoff = now.getTime() - ABANDONED_AFTER_HOURS * 60 * 60 * 1000;
  const listed = await getStorage().list(UPLOAD_KEY_PREFIX);
  return listed
    .filter((file) => UPLOAD_KEY_PATTERN.test(file.key) && file.lastModified.getTime() < cutoff)
    .sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());
}

// Third rule: of `keys`, the ones some resource (draft or published) still uses.
async function usedKeys(keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await getDb().Resource.findAll({ where: { fileKey: { [Op.in]: keys } }, attributes: ["fileKey"] });
  return new Set(rows.map((row) => row.fileKey as string));
}

async function abandonedNow(now: Date): Promise<AbandonedFile[]> {
  const old = await oldUploads(now);
  const used = await usedKeys(old.map((file) => file.key));
  return old.filter((file) => !used.has(file.key));
}

// Files in storage that no resource uses and that are older than ABANDONED_AFTER_HOURS.
export async function findAbandonedUploads(viewer: Viewer, now: Date = new Date()): Promise<AbandonedUploads> {
  await requireCurrentAdmin(viewer);
  const files = await abandonedNow(now);
  return { files, totalBytes: files.reduce((sum, file) => sum + file.size, 0) };
}

// Deletes the given keys that are STILL abandoned: every rule is checked again from a fresh listing
// and a fresh query, so a file that was saved or replaced since the scan is skipped. Only keys the
// caller passed are ever deleted.
export async function deleteAbandonedUploads(viewer: Viewer, keys: string[], now: Date = new Date()): Promise<DeleteResult> {
  await requireCurrentAdmin(viewer);
  const wanted = [...new Set(parseInput(deleteInputSchema, keys))];
  const abandoned = new Set((await abandonedNow(now)).map((file) => file.key));
  const storage = getStorage();
  const result: DeleteResult = { deleted: [], skipped: [] };
  for (const key of wanted) {
    if (!abandoned.has(key)) {
      result.skipped.push(key);
      continue;
    }
    try {
      await storage.delete(key);
      result.deleted.push(key);
    } catch (error) {
      // The key is not logged.
      console.error("abandoned upload delete failed", error instanceof Error ? error.message : "unknown error");
      result.skipped.push(key);
    }
  }
  return result;
}
