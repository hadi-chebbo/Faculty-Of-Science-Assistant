import { beforeAll, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/services/auth/access-token";
import { signStorageToken, verifyStorageToken } from "./token";

beforeAll(() => {
  process.env.AUTH_SECRET = "storage-test-secret-0123456789abcdef0123";
});

const put = { op: "put", key: "resources/a.pdf", contentType: "application/pdf", maxBytes: 10 } as const;
const get = { op: "get", key: "resources/a.pdf", disposition: "attachment", filename: "a.pdf" } as const;

describe("storage tokens", () => {
  it("round-trips both operations", async () => {
    expect(await verifyStorageToken(await signStorageToken(put, 60), "put")).toMatchObject(put);
    expect(await verifyStorageToken(await signStorageToken(get, 60), "get")).toMatchObject(get);
  });

  it("rejects an expired token", async () => {
    const token = await signStorageToken(put, 60, new Date(Date.now() - 120_000));
    expect(await verifyStorageToken(token, "put")).toBeNull();
  });

  it("rejects the wrong operation", async () => {
    expect(await verifyStorageToken(await signStorageToken(put, 60), "get")).toBeNull();
    expect(await verifyStorageToken(await signStorageToken(get, 60), "put")).toBeNull();
  });

  it("rejects a tampered, empty or missing token", async () => {
    const token = await signStorageToken(put, 60);
    expect(await verifyStorageToken(`${token.slice(0, -2)}xx`, "put")).toBeNull();
    expect(await verifyStorageToken("", "put")).toBeNull();
    expect(await verifyStorageToken(null, "put")).toBeNull();
  });

  it("is not a valid access token, and an access token is not a valid storage token", async () => {
    const storageToken = await signStorageToken(put, 60);
    expect(await verifyAccessToken(storageToken)).toBeNull();
    const { token } = await signAccessToken({ id: "u1", role: "admin" });
    expect(await verifyStorageToken(token, "put")).toBeNull();
    expect(await verifyStorageToken(token, "get")).toBeNull();
  });
});
