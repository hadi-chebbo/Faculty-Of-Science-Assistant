import { jwtVerify, SignJWT } from "jose";
import { USER_ROLES, type UserRole } from "@/db/constants";
import { getAuthEnv } from "@/lib/auth-env";
import type { Viewer } from "../viewer";
import { ACCESS_TOKEN_TTL_SECONDS, TOKEN_AUDIENCE, TOKEN_ISSUER } from "./constants";

const ALGORITHM = "HS256";

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthEnv().AUTH_SECRET);
}

// Short-lived, stateless: nothing is stored, so it cannot be revoked before it expires.
// `now` exists so tests can control the clock.
export async function signAccessToken(
  user: { id: string; role: UserRole },
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAt = issuedAt + ACCESS_TOKEN_TTL_SECONDS;
  const token = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(user.id)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secretKey());
  return { token, expiresAt: new Date(expiresAt * 1000) };
}

// Never throws for a bad token: anything that does not verify is an anonymous visitor.
// A missing or too-short AUTH_SECRET is a deployment error and does throw.
export async function verifyAccessToken(token: string, now: Date = new Date()): Promise<Viewer> {
  const key = secretKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALGORITHM], // rejects "none" and any other algorithm
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
      requiredClaims: ["sub", "exp", "iat"],
      currentDate: now,
    });
    const role = payload.role;
    if (typeof payload.sub !== "string" || typeof role !== "string") return null;
    if (!(USER_ROLES as readonly string[]).includes(role)) return null;
    return { id: payload.sub, role: role as UserRole };
  } catch {
    return null;
  }
}
