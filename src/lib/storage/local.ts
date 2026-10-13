import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { assertStorageKey } from "./keys";
import { signStorageToken } from "./token";
import type { FileStorage } from "./types";

// Files live at <dir>/<key>, with the content type beside them in <key>.meta.json. Writes go to a
// temporary name and are renamed, so a half-written upload is never visible.
// The signed URLs point at /api/v1/storage/local, which stands in for the cloud's signed URLs.
const ROUTE = "/api/v1/storage/local";

export function createLocalStorage(dir: string): FileStorage {
  const root = path.resolve(/*turbopackIgnore: true*/ dir);
  const fileOf = (key: string) => {
    assertStorageKey(key);
    return path.join(/*turbopackIgnore: true*/ root, ...key.split("/"));
  };

  return {
    async put(key, body, contentType) {
      const file = fileOf(key);
      await fs.mkdir(path.dirname(file), { recursive: true });
      const tmp = `${file}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(tmp, body);
        await fs.writeFile(`${file}.meta.json`, JSON.stringify({ contentType }));
        await fs.rename(tmp, file);
      } catch (error) {
        await fs.rm(tmp, { force: true });
        throw error;
      }
    },
    async stat(key) {
      const file = fileOf(key);
      let size: number;
      try {
        const info = await fs.stat(file);
        if (!info.isFile()) return null;
        size = info.size;
      } catch {
        return null;
      }
      let contentType: string | null = null;
      try {
        const meta = JSON.parse(await fs.readFile(`${file}.meta.json`, "utf8"));
        if (typeof meta.contentType === "string") contentType = meta.contentType;
      } catch {
        // No sidecar: the type is unknown.
      }
      return { size, contentType };
    },
    async readStart(key, bytes) {
      const file = fileOf(key);
      let handle;
      try {
        handle = await fs.open(file, "r");
      } catch {
        return null;
      }
      try {
        const buffer = new Uint8Array(bytes);
        const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
        return buffer.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    },
    async delete(key) {
      const file = fileOf(key);
      await fs.rm(file, { force: true });
      await fs.rm(`${file}.meta.json`, { force: true });
    },
    async createUploadUrl(key, { contentType, maxBytes, expiresInSeconds }) {
      assertStorageKey(key);
      const token = await signStorageToken({ op: "put", key, contentType, maxBytes }, expiresInSeconds);
      return { url: `${ROUTE}?token=${token}`, method: "PUT", headers: { "Content-Type": contentType } };
    },
    async createReadUrl(key, { expiresInSeconds, disposition, filename }) {
      assertStorageKey(key);
      const token = await signStorageToken({ op: "get", key, disposition, filename }, expiresInSeconds);
      return `${ROUTE}?token=${token}`;
    },
  };
}
