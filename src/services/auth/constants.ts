// Owner decisions: 15 minute access tokens, 30 day refresh tokens.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

// Claims we set and require when verifying.
export const TOKEN_ISSUER = "university-assistant";
export const TOKEN_AUDIENCE = "university-assistant-web";

// Sign-in rate limiting: failures inside the window count towards the limits.
export const ATTEMPT_WINDOW_SECONDS = 15 * 60;
export const MAX_FAILED_ATTEMPTS_PER_EMAIL = 5;
export const MAX_FAILED_ATTEMPTS_PER_IP = 20;
// Older failure rows are deleted whenever a new failure is recorded.
export const ATTEMPT_RETENTION_SECONDS = 24 * 60 * 60;

// Refresh tokens are 32 random bytes (256 bits), base64url encoded.
export const REFRESH_TOKEN_BYTES = 32;
