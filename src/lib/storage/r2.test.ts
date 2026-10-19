import { describe, expect, it } from "vitest";
import { createR2Storage } from "./r2";

const SECRET = "test-secret-access-key-VALUE";
const config = { accountId: "acct123", bucket: "my-bucket", accessKeyId: "AKIATEST", secretAccessKey: SECRET };
const KEY = "resources/abc.pdf";
const bytes = (text: string) => new TextEncoder().encode(text);

// A body whose cancel() never settles, as response bodies behaved inside Next.js. With
// `endAfterMs` it ends a moment after the bytes, like a real response whose end has not been read
// yet; without it, it never ends.
function uncancellableBody(text: string, endAfterMs?: number) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes(text));
      if (endAfterMs === undefined) return;
      setTimeout(() => {
        try {
          controller.close();
        } catch {
          // Already cancelled.
        }
      }, endAfterMs);
    },
    cancel: () => new Promise<void>(() => {}),
  });
}

function setup(respond: (request: Request) => Response | Promise<Response>) {
  const requests: Request[] = [];
  const fakeFetch = (async (input: Request) => {
    requests.push(input);
    return respond(input);
  }) as unknown as typeof fetch;
  const storage = createR2Storage(config, fakeFetch, () => new Date("2026-10-13T10:00:00.000Z"));
  return { storage, requests };
}

describe("r2 driver requests", () => {
  it("put sends a signed PUT with the body and content type", async () => {
    const { storage, requests } = setup(() => new Response(null, { status: 200 }));
    await storage.put(KEY, bytes("%PDF-1.7"), "application/pdf");
    const [request] = requests;
    const url = new URL(request.url);
    expect(request.method).toBe("PUT");
    expect(url.host).toBe("acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/my-bucket/resources/abc.pdf");
    expect(request.headers.get("Content-Type")).toBe("application/pdf");
    expect(request.headers.get("Authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(await request.text()).toBe("%PDF-1.7");
  });

  it("put throws on a failure status, without URL or body", async () => {
    const { storage } = setup(() => new Response("secret-body", { status: 500 }));
    const error = await storage.put(KEY, bytes("x"), "application/pdf").catch((e: Error) => e);
    expect((error as Error).message).toBe("R2 put failed with HTTP 500");
  });

  it("stat uses HEAD and reads size and type", async () => {
    const { storage, requests } = setup(
      () => new Response(null, { status: 200, headers: { "Content-Length": "1234", "Content-Type": "application/pdf" } }),
    );
    expect(await storage.stat(KEY)).toEqual({ size: 1234, contentType: "application/pdf" });
    expect(requests[0].method).toBe("HEAD");
    expect(new URL(requests[0].url).pathname).toBe("/my-bucket/resources/abc.pdf");
    expect(requests[0].headers.get("Authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("stat returns null for 404 and throws for 500", async () => {
    expect(await setup(() => new Response(null, { status: 404 })).storage.stat(KEY)).toBeNull();
    await expect(setup(() => new Response(null, { status: 500 })).storage.stat(KEY)).rejects.toThrow(
      "R2 stat failed with HTTP 500",
    );
  });

  it("readStart sends a Range header and accepts 206", async () => {
    const { storage, requests } = setup(() => new Response("%PDF-", { status: 206 }));
    expect(Buffer.from((await storage.readStart(KEY, 5))!).toString()).toBe("%PDF-");
    expect(requests[0].method).toBe("GET");
    expect(requests[0].headers.get("Range")).toBe("bytes=0-4");
    expect(requests[0].headers.get("Authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it("readStart never returns more than asked, even when the whole object comes back (200)", async () => {
    const { storage } = setup(() => new Response("0123456789", { status: 200 }));
    expect(Buffer.from((await storage.readStart(KEY, 4))!).toString()).toBe("0123");
  });

  it("readStart reads a 206 of the requested length to its end instead of cancelling it", { timeout: 2000 }, async () => {
    const { storage } = setup(
      () => new Response(uncancellableBody("%PDF-1.4", 20), { status: 206, headers: { "Content-Length": "8" } }),
    );
    expect(Buffer.from((await storage.readStart(KEY, 8))!).toString()).toBe("%PDF-1.4");
  });

  it("readStart does not wait for a 200 body to be cancelled", { timeout: 2000 }, async () => {
    const { storage } = setup(() => new Response(uncancellableBody("0123456789"), { status: 200 }));
    expect(Buffer.from((await storage.readStart(KEY, 4))!).toString()).toBe("0123");
  });

  it("readStart reads only what was asked from a 206 that is larger or has no length", { timeout: 2000 }, async () => {
    const larger = setup(
      () => new Response(uncancellableBody("%PDF-1.4 and much more"), { status: 206, headers: { "Content-Length": "1000000" } }),
    );
    expect(Buffer.from((await larger.storage.readStart(KEY, 8))!).toString()).toBe("%PDF-1.4");
    const unknown = setup(() => new Response(uncancellableBody("%PDF-1.4 and much more"), { status: 206 }));
    expect(Buffer.from((await unknown.storage.readStart(KEY, 8))!).toString()).toBe("%PDF-1.4");
  });

  it("readStart returns fewer bytes for a short object", async () => {
    const { storage } = setup(() => new Response("abc", { status: 206 }));
    expect((await storage.readStart(KEY, 100))!.length).toBe(3);
  });

  it("readStart returns an empty array for 416 (empty object), null for 404", async () => {
    expect((await setup(() => new Response(null, { status: 416 })).storage.readStart(KEY, 5))!.length).toBe(0);
    expect(await setup(() => new Response(null, { status: 404 })).storage.readStart(KEY, 5)).toBeNull();
  });

  it("readStart throws for 500", async () => {
    await expect(setup(() => new Response(null, { status: 500 })).storage.readStart(KEY, 5)).rejects.toThrow(
      "R2 readStart failed with HTTP 500",
    );
  });

  it("delete sends DELETE, accepts 204 and 404, throws for 500", async () => {
    const ok = setup(() => new Response(null, { status: 204 }));
    await ok.storage.delete(KEY);
    expect(ok.requests[0].method).toBe("DELETE");
    expect(ok.requests[0].headers.get("Authorization")).toMatch(/^AWS4-HMAC-SHA256 /);
    await setup(() => new Response(null, { status: 404 })).storage.delete(KEY);
    await expect(setup(() => new Response(null, { status: 500 })).storage.delete(KEY)).rejects.toThrow(
      "R2 delete failed with HTTP 500",
    );
  });

  it("rejects an invalid key before any request", async () => {
    const { storage, requests } = setup(() => new Response(null, { status: 200 }));
    const bad = "../etc/passwd";
    await expect(storage.put(bad, bytes("x"), "application/pdf")).rejects.toThrow("Invalid storage key");
    await expect(storage.stat(bad)).rejects.toThrow("Invalid storage key");
    await expect(storage.readStart(bad, 5)).rejects.toThrow("Invalid storage key");
    await expect(storage.delete(bad)).rejects.toThrow("Invalid storage key");
    await expect(storage.createReadUrl(bad, { expiresInSeconds: 60, disposition: "inline" })).rejects.toThrow("Invalid storage key");
    await expect(
      storage.createUploadUrl("A/B", { contentType: "application/pdf", maxBytes: 10, expiresInSeconds: 60 }),
    ).rejects.toThrow("Invalid storage key");
    expect(requests).toHaveLength(0);
  });
});

describe("r2 signed URLs", () => {
  const { storage, requests } = setup(() => new Response(null, { status: 200 }));

  it("creates a signed read URL for inline display", async () => {
    const url = new URL(await storage.createReadUrl(KEY, { expiresInSeconds: 300, disposition: "inline" }));
    expect(url.host).toBe("acct123.r2.cloudflarestorage.com");
    expect(url.pathname).toBe("/my-bucket/resources/abc.pdf");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("response-content-disposition")).toBe("inline");
    expect(url.searchParams.get("response-content-type")).toBe("application/pdf");
    expect(url.toString()).not.toContain(SECRET);
  });

  it("sets a download name for attachments and sanitises a hostile one", async () => {
    const url = new URL(
      await storage.createReadUrl(KEY, { expiresInSeconds: 60, disposition: "attachment", filename: 'a"b/c\r\nd.pdf' }),
    );
    expect(url.searchParams.get("response-content-disposition")).toBe('attachment; filename="abcd.pdf"');
  });

  it("sets no response type for a key that is not a pdf", async () => {
    const url = new URL(await storage.createReadUrl("test/x.bin", { expiresInSeconds: 60, disposition: "inline" }));
    expect(url.searchParams.has("response-content-type")).toBe(false);
  });

  it("creates a signed upload URL that signs the content type", async () => {
    const result = await storage.createUploadUrl(KEY, { contentType: "application/pdf", maxBytes: 1000, expiresInSeconds: 600 });
    const url = new URL(result.url);
    expect(result.method).toBe("PUT");
    expect(result.headers).toEqual({ "Content-Type": "application/pdf" });
    expect(url.pathname).toBe("/my-bucket/resources/abc.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain("content-type");
    expect(result.url).not.toContain(SECRET);
  });

  it("is deterministic for a fixed clock", async () => {
    const options = { expiresInSeconds: 300, disposition: "inline" as const };
    expect(await storage.createReadUrl(KEY, options)).toBe(await storage.createReadUrl(KEY, options));
    expect(new URL(await storage.createReadUrl(KEY, options)).searchParams.get("X-Amz-Date")).toBe("20261013T100000Z");
  });

  it("makes no request when creating URLs", () => {
    expect(requests).toHaveLength(0);
  });
});

describe("r2 errors", () => {
  it("never include the secret, a query string or the key", async () => {
    const { storage } = setup(() => new Response(`<Error>${SECRET}</Error>`, { status: 403 }));
    const error = (await storage.put(KEY, bytes("x"), "application/pdf").catch((e: Error) => e)) as Error;
    expect(error.message).not.toContain(SECRET);
    expect(error.message).not.toContain("?");
    expect(error.message).not.toContain("abc.pdf");
    expect(error.message).toContain("403");
  });
});
