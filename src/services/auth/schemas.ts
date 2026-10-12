import { z } from "zod";

// Caps keep an attacker from making us hash megabytes or store huge rows.
export const PASSWORD_MAX_LENGTH = 1024;
export const EMAIL_MAX_LENGTH = 254;
export const IP_MAX_LENGTH = 64;
export const TOKEN_MAX_LENGTH = 512;

export const signInSchema = z.object({
  // Same normalisation as the users table: trimmed and lowercase.
  email: z.string().trim().toLowerCase().min(3).max(EMAIL_MAX_LENGTH).pipe(z.email()),
  // Not trimmed or otherwise changed: it is compared exactly as typed.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  ip: z.string().trim().min(1).max(IP_MAX_LENGTH),
});

// A malformed token is treated like an unknown one (the caller learns nothing), so this is
// checked with safeParse and never reported as a ValidationError.
export const rawTokenSchema = z.string().min(1).max(TOKEN_MAX_LENGTH);
