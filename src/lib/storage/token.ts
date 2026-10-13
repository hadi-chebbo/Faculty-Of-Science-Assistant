import { jwtVerify, SignJWT } from "jose";
import { getAuthEnv } from "@/lib/auth-env";

// Tokens for the local driver's signed URLs. Same secret as access tokens but a different
// audience (and no subject), so neither kind is ever accepted in place of the other.
const ALGORITHM = "HS256";
const AUDIENCE = "ua-storage";

export type StorageGrant =
  | { op: "put"; key: string; contentType: string; maxBytes: number }
  | { op: "get"; key: string; disposition: "inline" | "attachment"; filename?: string };

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthEnv().AUTH_SECRET);
}

// `now` exists so tests can control the clock.
export async function signStorageToken(
  grant: StorageGrant,
  expiresInSeconds: number,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ ...grant })
    .setProtectedHeader({ alg: ALGORITHM })
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + expiresInSeconds)
    .sign(secretKey());
}

// Returns the grant, or null for anything wrong: signature, expiry, audience or operation.
export async function verifyStorageToken<Op extends StorageGrant["op"]>(
  token: string | null,
  op: Op,
  now: Date = new Date(),
): Promise<Extract<StorageGrant, { op: Op }> | null> {
  if (!token) return null;
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM],
      audience: AUDIENCE,
      requiredClaims: ["exp", "iat"],
      currentDate: now,
    });
    if (payload.op !== op || typeof payload.key !== "string") return null;
    if (op === "put") {
      if (typeof payload.contentType !== "string" || typeof payload.maxBytes !== "number") return null;
    } else {
      if (payload.disposition !== "inline" && payload.disposition !== "attachment") return null;
      if (payload.filename !== undefined && typeof payload.filename !== "string") return null;
    }
    return payload as unknown as Extract<StorageGrant, { op: Op }>;
  } catch {
    return null;
  }
}
