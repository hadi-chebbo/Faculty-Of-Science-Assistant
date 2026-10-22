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

// Sign-up and email confirmation.
export const CONFIRMATION_TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const CONFIRMATION_TOKEN_BYTES = 32;
export const PASSWORD_MIN_LENGTH = 10;
export const NAME_MAX_LENGTH = 100;
// Sign-ups from one IP inside the window.
export const SIGN_UP_LIMIT_PER_IP = 5;
export const SIGN_UP_WINDOW_SECONDS = 60 * 60;
// Confirmation-type emails (confirm, already-registered) to one address.
export const CONFIRMATION_EMAIL_MIN_INTERVAL_SECONDS = 60;
export const CONFIRMATION_EMAILS_PER_DAY = 5;
export const CONFIRMATION_EMAIL_DAY_SECONDS = 24 * 60 * 60;
// Rate-limit rows older than this are deleted whenever a new one is recorded.
export const RATE_LIMIT_RETENTION_SECONDS = 2 * 24 * 60 * 60;
// Accounts never confirmed within this time are deleted by the daily sweep.
export const UNCONFIRMED_ACCOUNT_TTL_SECONDS = 7 * 24 * 60 * 60;
