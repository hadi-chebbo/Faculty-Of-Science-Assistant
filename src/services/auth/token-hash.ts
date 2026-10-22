import { createHash } from "node:crypto";

// The database only ever sees this hash; the raw token lives in the cookie or the emailed link alone.
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
