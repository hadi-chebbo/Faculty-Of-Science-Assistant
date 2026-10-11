// Single list of allowed values. Must match the check constraints created by the migrations.
export const RESOURCE_TYPES = ["lecture", "notes", "exercise", "exam", "solution", "other"] as const;
export const EXAM_SESSIONS = ["partial", "final", "second"] as const;
export const LANGUAGES = ["en", "fr"] as const;
export const USER_ROLES = ["student", "admin"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type ExamSession = (typeof EXAM_SESSIONS)[number];
export type Language = (typeof LANGUAGES)[number];
export type UserRole = (typeof USER_ROLES)[number];
