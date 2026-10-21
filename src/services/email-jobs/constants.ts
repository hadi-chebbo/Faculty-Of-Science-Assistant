// Wait after the 1st, 2nd, ... failed attempt. The attempt after the last entry fails for good.
export const BACKOFF_MINUTES = [1, 5, 30, 120, 720];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;
export const SENT_RETENTION_DAYS = 30;
export const FAILED_RETENTION_DAYS = 90;
export const SWEEP_LIMIT = 50;
// A claimed job is not due again for this long, even if the runner dies before finishing.
export const CLAIM_LEASE_MINUTES = 10;
