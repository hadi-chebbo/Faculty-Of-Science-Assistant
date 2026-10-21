import { AwsClient } from "aws4fetch";
import { attachmentDisposition } from "./filename";
import { assertStorageKey, assertStoragePrefix } from "./keys";
import type { FileStorage } from "./types";

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decodeXml = (text: string) =>
  text.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_, dec, hex, name) =>
    name ? XML_ENTITIES[name] : String.fromCodePoint(dec ? Number(dec) : parseInt(hex, 16)),
  );
const tagOf = (xml: string, tag: string) => {
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`).exec(xml);
  return match ? decodeXml(match[1]) : null;
};

export type R2Config = { accountId: string; bucket: string; accessKeyId: string; secretAccessKey: string };

// Cloudflare R2 speaks the S3 API: path-style addressing (/<bucket>/<key>), region "auto".
// Requests are signed with aws4fetch and sent with the injected `fetch`, so tests need no network.
// Errors name the operation and the HTTP status only: never the URL, the key or the response
// body, which could carry a signed URL or a secret.
export function createR2Storage(
  config: R2Config,
  fetchImpl: typeof fetch = fetch,
  now: () => Date = () => new Date(),
): FileStorage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const urlOf = (key: string) => new URL(`https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}/${key}`);
  const datetime = () => now().toISOString().replace(/[:-]|\.\d{3}/g, "");

  const call = async (key: string, init: { method: string; headers?: Record<string, string>; body?: Uint8Array }) => {
    assertStorageKey(key);
    const signed = await client.sign(urlOf(key), {
      method: init.method,
      headers: init.headers,
      body: init.body as BodyInit | undefined,
      aws: { datetime: datetime() },
    });
    return fetchImpl(signed);
  };
  const fail = (operation: string, response: Response): never => {
    throw new Error(`R2 ${operation} failed with HTTP ${response.status}`);
  };

  return {
    async put(key, body, contentType) {
      const response = await call(key, { method: "PUT", headers: { "Content-Type": contentType }, body });
      if (!response.ok) fail("put", response);
    },

    async stat(key) {
      const response = await call(key, { method: "HEAD" });
      if (response.status === 404) return null;
      if (!response.ok) fail("stat", response);
      return { size: Number(response.headers.get("Content-Length") ?? 0), contentType: response.headers.get("Content-Type") };
    },

    async readStart(key, bytes) {
      const want = Math.max(0, Math.floor(bytes));
      const response = await call(key, { method: "GET", headers: { Range: `bytes=0-${Math.max(want, 1) - 1}` } });
      if (response.status === 404) return null;
      // R2 answers 416 for a range on an empty object.
      if (response.status === 416) return new Uint8Array(0);
      if (!response.ok) fail("readStart", response);
      // R2 answers the range with 206 and only the requested bytes. When the declared length proves
      // that, the body is read to its end, which leaves nothing to cancel and no connection half-read.
      const declared = response.headers.get("Content-Length");
      if (response.status === 206 && declared !== null && Number(declared) <= want) {
        return new Uint8Array(await response.arrayBuffer()).subarray(0, want);
      }
      // Anything else (a 200 with the whole object, or a body of unknown or larger size): read only
      // what was asked for, then stop the download. The stop is not awaited: inside Next.js, awaiting
      // cancel() on a response body hung until the socket timed out (about five minutes).
      const out = new Uint8Array(want);
      let length = 0;
      const reader = response.body?.getReader();
      if (reader) {
        while (length < want) {
          const { done, value } = await reader.read();
          if (done) break;
          const take = Math.min(value.byteLength, want - length);
          out.set(value.subarray(0, take), length);
          length += take;
        }
        reader.cancel().catch(() => {});
      }
      return out.subarray(0, length);
    },

    async delete(key) {
      const response = await call(key, { method: "DELETE" });
      if (!response.ok && response.status !== 404) fail("delete", response);
    },

    // ListObjectsV2, following continuation tokens until the listing is no longer truncated.
    async list(prefix) {
      assertStoragePrefix(prefix);
      const found: { key: string; size: number; lastModified: Date }[] = [];
      let token: string | null = null;
      do {
        const url = new URL(`https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`);
        url.searchParams.set("list-type", "2");
        url.searchParams.set("prefix", prefix);
        if (token) url.searchParams.set("continuation-token", token);
        const response = await fetchImpl(await client.sign(url, { method: "GET", aws: { datetime: datetime() } }));
        if (!response.ok) fail("list", response);
        const xml = await response.text();
        for (const block of xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? []) {
          const key = tagOf(block, "Key");
          const modified = tagOf(block, "LastModified");
          if (key === null || modified === null) continue;
          found.push({ key, size: Number(tagOf(block, "Size") ?? 0), lastModified: new Date(modified) });
        }
        token = tagOf(xml, "IsTruncated") === "true" ? tagOf(xml, "NextContinuationToken") : null;
      } while (token);
      return found;
    },

    async createReadUrl(key, { expiresInSeconds, disposition, filename }) {
      assertStorageKey(key);
      const url = urlOf(key);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      url.searchParams.set(
        "response-content-disposition",
        disposition === "inline" ? "inline" : attachmentDisposition(filename),
      );
      if (key.endsWith(".pdf")) url.searchParams.set("response-content-type", "application/pdf");
      const signed = await client.sign(url, { method: "GET", aws: { signQuery: true, datetime: datetime() } });
      return signed.url;
    },

    // The Content-Type is signed into the URL, so R2 refuses an upload that sends another type.
    // `maxBytes` is NOT enforced by R2: a signed PUT URL cannot limit the size. The server-side
    // check after the upload (size and first bytes) is what enforces size and content.
    async createUploadUrl(key, { contentType, expiresInSeconds }) {
      assertStorageKey(key);
      const url = urlOf(key);
      url.searchParams.set("X-Amz-Expires", String(expiresInSeconds));
      const signed = await client.sign(url, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        aws: { signQuery: true, allHeaders: true, datetime: datetime() },
      });
      return { url: signed.url, method: "PUT", headers: { "Content-Type": contentType } };
    },
  };
}
