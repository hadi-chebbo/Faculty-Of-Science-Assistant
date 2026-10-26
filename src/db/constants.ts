// Single list of allowed values. Must match the check constraints created by the migrations.
export const RESOURCE_TYPES = ["lecture", "notes", "exercise", "exam", "solution", "other"] as const;
export const EXAM_SESSIONS = ["partial", "final", "second"] as const;
export const LANGUAGES = ["en", "fr"] as const;
export const USER_ROLES = ["student", "admin"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type ExamSession = (typeof EXAM_SESSIONS)[number];
export type Language = (typeof LANGUAGES)[number];
export type UserRole = (typeof USER_ROLES)[number];

// Ranges enforced by the check constraints, shared with input validation so the two cannot drift.
export const SEMESTER_MIN = 3;
export const SEMESTER_MAX = 6;
export const ACADEMIC_YEAR_MIN = 1990;
export const ACADEMIC_YEAR_MAX = 2100;
export const COURSE_CODE_MAX_LENGTH = 20;
export const RESOURCE_TITLE_MAX_LENGTH = 200;
export const CHAPTER_POSITION_MIN = 1;
export const CHAPTER_POSITION_MAX = 200;
export const CHAPTER_TITLE_MAX_LENGTH = 200;
// Renumbering moves chapters into 101..200 first, so a course must never hold more than 100.
export const CHAPTER_COUNT_MAX = 100;

// To-do board columns, in the order they are shown. Must match todos_status_check.
export const TODO_STATUSES = ["todo", "in_progress", "done"] as const;
export type TodoStatus = (typeof TODO_STATUSES)[number];
export const TODO_TITLE_MAX_LENGTH = 200;
export const TODO_NOTE_MAX_LENGTH = 2000;
// Live cards per user; soft-deleted ones do not count.
export const TODO_MAX_CARDS = 500;

// Uploaded resource files: PDF only, up to 50 MB. Checked again on the server after upload.
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const UPLOAD_CONTENT_TYPE = "application/pdf";
