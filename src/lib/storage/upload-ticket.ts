import { jwtVerify, SignJWT } from "jose";
import { getAuthEnv } from "@/lib/auth-env";

// Proves which stored object the admin's browser uploaded, so the key never has to travel through
// the browser in the clear and cannot be chosen by it. Same secret as the other tokens but its own
// audience, so a ticket is never accepted as an access token or a storage token, nor the reverse.
const ALGORITHM = "HS256";
const AUDIENCE = "ua-upload";

export const UPLOAD_TICKET_LIFETIME_SECONDS = 60 * 60;

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthEnv().AUTH_SECRET);
}

// `now` exists so tests can control the clock.
export async function signUploadTicket(
  key: string,
  expiresInSeconds: number = UPLOAD_TICKET_LIFETIME_SECONDS,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ key })
    .setProtectedHeader({ alg: ALGORITHM })
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + expiresInSeconds)
    .sign(secretKey());
}

// The storage key, or null for anything wrong: signature, expiry, audience or shape.
export async function verifyUploadTicket(ticket: string | null, now: Date = new Date()): Promise<string | null> {
  if (!ticket) return null;
  try {
    const { payload } = await jwtVerify(ticket, secretKey(), {
      algorithms: [ALGORITHM],
      audience: AUDIENCE,
      requiredClaims: ["exp", "iat"],
      currentDate: now,
    });
    return typeof payload.key === "string" ? payload.key : null;
  } catch {
    return null;
  }
}
