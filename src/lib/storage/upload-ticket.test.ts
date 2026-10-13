import { SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { signAccessToken, verifyAccessToken } from "@/services/auth/access-token";
import { signStorageToken, verifyStorageToken } from "./token";
import { signUploadTicket, verifyUploadTicket } from "./upload-ticket";

const SECRET = "storage-test-secret-0123456789abcdef0123";

beforeAll(() => {
  process.env.AUTH_SECRET = SECRET;
});

const KEY = "resources/a.pdf";

describe("upload tickets", () => {
  it("round-trips the key", async () => {
    expect(await verifyUploadTicket(await signUploadTicket(KEY, 60))).toBe(KEY);
  });

  it("defaults to a one hour lifetime", async () => {
    const now = new Date();
    const ticket = await signUploadTicket(KEY, undefined, now);
    expect(await verifyUploadTicket(ticket, new Date(now.getTime() + 59 * 60_000))).toBe(KEY);
    expect(await verifyUploadTicket(ticket, new Date(now.getTime() + 61 * 60_000))).toBeNull();
  });

  it("rejects an expired ticket", async () => {
    const ticket = await signUploadTicket(KEY, 60, new Date(Date.now() - 120_000));
    expect(await verifyUploadTicket(ticket)).toBeNull();
  });

  it("rejects a tampered, empty or missing ticket", async () => {
    const ticket = await signUploadTicket(KEY, 60);
    expect(await verifyUploadTicket(`${ticket.slice(0, -2)}xx`)).toBeNull();
    expect(await verifyUploadTicket("")).toBeNull();
    expect(await verifyUploadTicket(null)).toBeNull();
  });

  it("rejects a token with another audience, even with the right secret", async () => {
    const wrong = await new SignJWT({ key: KEY })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("someone-else")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifyUploadTicket(wrong)).toBeNull();
  });

  it("is not an access token or a storage token, and neither is a ticket", async () => {
    const ticket = await signUploadTicket(KEY, 60);
    expect(await verifyAccessToken(ticket)).toBeNull();
    expect(await verifyStorageToken(ticket, "put")).toBeNull();
    expect(await verifyStorageToken(ticket, "get")).toBeNull();

    const { token } = await signAccessToken({ id: "u1", role: "admin" });
    expect(await verifyUploadTicket(token)).toBeNull();
    const storageToken = await signStorageToken(
      { op: "get", key: KEY, disposition: "inline" },
      60,
    );
    expect(await verifyUploadTicket(storageToken)).toBeNull();
  });
});
