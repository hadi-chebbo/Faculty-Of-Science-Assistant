import { z } from "zod";

// Kept apart from env.ts on purpose: only code that signs or verifies tokens needs AUTH_SECRET,
// so `next build`, /api/health and the public pages keep working when it is unset.
export const AUTH_SECRET_MIN_LENGTH = 32;

const authEnvSchema = z.object({
  AUTH_SECRET: z
    .string()
    .min(1, "AUTH_SECRET is required")
    .min(AUTH_SECRET_MIN_LENGTH, `AUTH_SECRET must be at least ${AUTH_SECRET_MIN_LENGTH} characters`),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

export function parseAuthEnv(source: Record<string, string | undefined>): AuthEnv {
  const result = authEnvSchema.safeParse(source);
  if (!result.success) {
    // Variable names and rules only, never values.
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid auth configuration: ${problems}`);
  }
  return result.data;
}

let cached: AuthEnv | undefined;

// Throws when AUTH_SECRET is missing or too short. Call it only where a token is signed or verified.
export function getAuthEnv(): AuthEnv {
  cached ??= parseAuthEnv(process.env);
  return cached;
}
