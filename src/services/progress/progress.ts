import { Op, QueryTypes, type Transaction } from "sequelize";
import { z } from "zod";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { addDays, beirutDate, beirutWeekStart } from "./beirut-date";
import { COUNTED_TYPES, MARKABLE_TYPES } from "./markable";
import type { CourseProgress, MarkResult, Progress, ProgressOverview } from "./types";

// Completions: a student's explicit "Mark as done" on a file (terms in GLOSSARY.md). Opening or
// downloading a file never makes one. Every function acts only on the viewer's own rows.

const idSchema = z.uuid();

function validId(resourceId: string): boolean {
  return idSchema.safeParse(resourceId).success;
}

// Finished means there is something to do and all of it is done.
const finished = (done: number, total: number) => total >= 1 && done === total;

interface ResourceRef {
  courseId: string;
  chapterId: string | null;
}

// Live counts over the course's published files, for one student. Nothing is stored or cached.
async function progressOf(viewer: NonNullable<Viewer>, resource: ResourceRef, transaction?: Transaction): Promise<Progress> {
  const { sequelize, Course, Chapter } = getDb();
  const [counts] = await sequelize.query<Record<string, string>>(
    `SELECT
       count(*) FILTER (WHERE r.type = ANY($3::text[])) AS course_total,
       count(c.id) FILTER (WHERE r.type = ANY($3::text[])) AS course_done,
       count(*) FILTER (WHERE r.type = 'exam') AS exams_total,
       count(c.id) FILTER (WHERE r.type = 'exam') AS exams_done,
       count(*) FILTER (WHERE r.type = ANY($3::text[]) AND r.chapter_id = $4::uuid) AS chapter_total,
       count(c.id) FILTER (WHERE r.type = ANY($3::text[]) AND r.chapter_id = $4::uuid) AS chapter_done
     FROM resources r
     LEFT JOIN completions c ON c.resource_id = r.id AND c.user_id = $1
     WHERE r.course_id = $2 AND r.is_published`,
    { bind: [viewer.id, resource.courseId, [...COUNTED_TYPES], resource.chapterId], type: QueryTypes.SELECT, transaction },
  );
  const n = (key: string) => Number(counts[key]);
  const course = await Course.findByPk(resource.courseId, { attributes: ["code"], transaction, rejectOnEmpty: true });
  const chapter = resource.chapterId
    ? await Chapter.findByPk(resource.chapterId, { attributes: ["id", "position", "title"], transaction })
    : null;
  return {
    course: { code: course.code, done: n("course_done"), total: n("course_total"), finished: finished(n("course_done"), n("course_total")) },
    exams: { done: n("exams_done"), total: n("exams_total") },
    chapter: chapter
      ? {
          id: chapter.id,
          position: chapter.position,
          title: chapter.title,
          done: n("chapter_done"),
          total: n("chapter_total"),
          finished: finished(n("chapter_done"), n("chapter_total")),
        }
      : null,
  };
}

// Marks a file as done. Marking twice is fine (`created` is then false). Only a published lecture,
// notes, exercise or exam can be marked, the admin included; anything else is not found. The
// insert ignores a duplicate, so two requests at once cannot collide.
// A new completion also records the Beirut day as an active day, in the same transaction; the
// day is never removed, by un-marking or otherwise.
export async function markDone(viewer: NonNullable<Viewer>, resourceId: string, options: { now?: Date } = {}): Promise<MarkResult> {
  const { sequelize, Resource } = getDb();
  const resource = validId(resourceId)
    ? await Resource.findOne({
        where: { id: resourceId, isPublished: true, type: { [Op.in]: [...MARKABLE_TYPES] } },
        attributes: ["id", "courseId", "chapterId"],
      })
    : null;
  if (!resource) throw new NotFoundError("Resource not found");
  return sequelize.transaction(async (transaction) => {
    const inserted = await sequelize.query(
      `INSERT INTO completions (user_id, resource_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
      { bind: [viewer.id, resourceId], type: QueryTypes.SELECT, transaction },
    );
    const created = inserted.length > 0;
    if (created) {
      await sequelize.query(`INSERT INTO study_days (user_id, day) VALUES ($1, $2) ON CONFLICT DO NOTHING`, {
        bind: [viewer.id, beirutDate(options.now ?? new Date())],
        transaction,
      });
    }
    return { created, progress: await progressOf(viewer, resource, transaction) };
  });
}

// Un-marks a file. Always succeeds, published or not, marked or not. `progress` is null only for
// a file that no longer exists.
export async function unmarkDone(viewer: NonNullable<Viewer>, resourceId: string): Promise<{ progress: Progress | null }> {
  if (!validId(resourceId)) throw new NotFoundError("Resource not found");
  const { Completion, Resource } = getDb();
  await Completion.destroy({ where: { userId: viewer.id, resourceId } });
  const resource = await Resource.findByPk(resourceId, { attributes: ["courseId", "chapterId"] });
  return { progress: resource ? await progressOf(viewer, resource) : null };
}

// The ids of the viewer's completed files that are published right now.
export async function listCompletedIds(viewer: NonNullable<Viewer>): Promise<string[]> {
  const { Completion, Resource } = getDb();
  const rows = await Completion.findAll({
    where: { userId: viewer.id },
    attributes: ["resourceId"],
    include: [{ model: Resource, as: "resource", attributes: [], where: { isPublished: true }, required: true }],
    order: [["createdAt", "DESC"]],
    raw: true,
  });
  return rows.map((row) => row.resourceId);
}

interface CountRow {
  chapter_id: string | null;
  is_exam: boolean;
  total: string;
  done: string;
}

interface ChapterRef {
  id: string;
  position: number;
  title: string;
}

const withFinished = (counts: { done: number; total: number }) => ({ ...counts, finished: finished(counts.done, counts.total) });

// Turns the grouped counts of one course (by chapter, exams apart) into its course, exams, chapter
// and General figures. Shared by the course page and the overview so both count the same way.
function summarize(rows: CountRow[], chapters: ChapterRef[]) {
  const sum = (match: (row: CountRow) => boolean) =>
    rows.filter(match).reduce((acc, row) => ({ done: acc.done + Number(row.done), total: acc.total + Number(row.total) }), { done: 0, total: 0 });
  return {
    course: withFinished(sum((row) => !row.is_exam)),
    exams: sum((row) => row.is_exam),
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      ...withFinished(sum((row) => !row.is_exam && row.chapter_id === chapter.id)),
    })),
    general: withFinished(sum((row) => !row.is_exam && row.chapter_id === null)),
  };
}

// Progress of the whole course page: course, exams, every chapter (empty ones too, by position) and
// General (counted files with no chapter). One grouped count over the published files, computed
// live. The admin gets the same as a student.
export async function getCourseProgress(viewer: NonNullable<Viewer>, courseCode: string): Promise<CourseProgress> {
  const { sequelize, Course, Chapter } = getDb();
  const course = await Course.findOne({ where: { code: courseCode }, attributes: ["id", "code", "title"] });
  if (!course) throw new NotFoundError("Course not found");
  const chapters = await Chapter.findAll({
    where: { courseId: course.id },
    attributes: ["id", "position", "title"],
    order: [["position", "ASC"]],
  });
  const rows = await sequelize.query<CountRow>(
    `SELECT r.chapter_id, (r.type = 'exam') AS is_exam, count(*) AS total, count(c.id) AS done
     FROM resources r
     LEFT JOIN completions c ON c.resource_id = r.id AND c.user_id = $1
     WHERE r.course_id = $2 AND r.is_published AND r.type = ANY($3::text[])
     GROUP BY r.chapter_id, (r.type = 'exam')`,
    { bind: [viewer.id, course.id, [...COUNTED_TYPES, "exam"]], type: QueryTypes.SELECT },
  );
  const summary = summarize(rows, chapters);
  return { ...summary, course: { code: course.code, title: course.title, ...summary.course } };
}

// The progress page: every course where the viewer has marked at least one currently published
// file (My courses), by semester then code. All of them are counted in one grouped query (by
// course, chapter and exam or not), then split per course in memory with the same rules as the
// course page. `lastCompletedAt` is the latest completion in the course.
export async function getProgressOverview(viewer: NonNullable<Viewer>, options: { now?: Date } = {}): Promise<ProgressOverview> {
  const { sequelize, Course, Chapter } = getDb();
  const now = options.now ?? new Date();
  const start = beirutWeekStart(now);
  const [activeDays, hasCompletions] = await Promise.all([
    sequelize
      .query<{ day: string }>(`SELECT day::text AS day FROM study_days WHERE user_id = $1 AND day BETWEEN $2::date AND $3::date ORDER BY day`, {
        bind: [viewer.id, start, addDays(start, 6)],
        type: QueryTypes.SELECT,
      })
      .then((rows) => rows.map((row) => row.day)),
    // Ever marked anything: a completion now, or an active day kept after un-marking.
    sequelize
      .query<{ found: boolean }>(
        `SELECT (EXISTS (SELECT 1 FROM completions WHERE user_id = $1) OR EXISTS (SELECT 1 FROM study_days WHERE user_id = $1)) AS found`,
        { bind: [viewer.id], type: QueryTypes.SELECT },
      )
      .then(([row]) => row.found),
  ]);
  const week = { start, today: beirutDate(now), activeDays };
  const rows = await sequelize.query<CountRow & { course_id: string; last_completed_at: Date | null }>(
    `SELECT r.course_id, r.chapter_id, (r.type = 'exam') AS is_exam,
            count(*) AS total, count(c.id) AS done, max(c.created_at) AS last_completed_at
     FROM resources r
     LEFT JOIN completions c ON c.resource_id = r.id AND c.user_id = $1
     WHERE r.is_published AND r.type = ANY($2::text[])
       AND r.course_id IN (
         SELECT r2.course_id FROM completions c2 JOIN resources r2 ON r2.id = c2.resource_id
         WHERE c2.user_id = $1 AND r2.is_published AND r2.type = ANY($2::text[])
       )
     GROUP BY r.course_id, r.chapter_id, (r.type = 'exam')`,
    { bind: [viewer.id, [...MARKABLE_TYPES]], type: QueryTypes.SELECT },
  );
  const courseIds = [...new Set(rows.map((row) => row.course_id))];
  if (courseIds.length === 0) return { courses: [], week, hasCompletions };
  const [courses, chapters] = await Promise.all([
    Course.findAll({ where: { id: courseIds }, attributes: ["id", "code", "title", "semester"], order: [["semester", "ASC"], ["code", "ASC"]] }),
    Chapter.findAll({ where: { courseId: courseIds }, attributes: ["id", "courseId", "position", "title"], order: [["position", "ASC"]] }),
  ]);
  return {
    week,
    hasCompletions,
    courses: courses.map((course) => {
      const own = rows.filter((row) => row.course_id === course.id);
      const last = own.reduce<Date | null>((latest, row) => (row.last_completed_at && (!latest || row.last_completed_at > latest) ? row.last_completed_at : latest), null);
      return {
        code: course.code,
        title: course.title,
        semester: course.semester,
        lastCompletedAt: (last ?? new Date(0)).toISOString(),
        ...summarize(own, chapters.filter((chapter) => chapter.courseId === course.id)),
      };
    }),
  };
}
