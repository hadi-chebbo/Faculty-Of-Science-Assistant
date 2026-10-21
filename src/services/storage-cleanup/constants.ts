// What counts as an abandoned upload. Shared by the admin page and, later, the scheduled cleanup.

// An upload ticket lasts 1 hour, so a file older than this can no longer belong to a save in progress.
export const ABANDONED_AFTER_HOURS = 24;

// The shape of every key the app generates (`newResourceFileKey`). Any other key is never touched.
export const UPLOAD_KEY_PATTERN = /^resources\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export const UPLOAD_KEY_PREFIX = "resources/";

// The most keys one delete call accepts.
export const DELETE_KEYS_MAX = 500;
