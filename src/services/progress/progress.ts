import { Op, QueryTypes, type Transaction } from "sequelize";
import { z } from "zod";
import { MILESTONE_KEYS, MILESTONE_LABELS, type MilestoneKey } from "@/db/constants";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { addDays, beirutDate, beirutWeekStart } from "./beirut-date";
import { COUNTED_TYPES, MARKABLE_TYPES } from "./markable";
import type { CourseProgress, MarkResult, Progress, ProgressOverview, Rewards } from "./types";

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
  return getDb().sequelize.transaction((transaction) => markDoneWithin(viewer, resourceId, transaction, options));
}

// The body of `markDone`, for callers that already hold a transaction (moving a to-do card into
// Done marks its file in the move's own transaction).
export async function markDoneWithin(
  viewer: NonNullable<Viewer>,
  resourceId: string,
  transaction: Transaction,
  options: { now?: Date } = {},
): Promise<MarkResult> {
  const { sequelize, Resource } = getDb();
  const resource = validId(resourceId)
    ? await Resource.findOne({
        where: { id: resourceId, isPublished: true, type: { [Op.in]: [...MARKABLE_TYPES] } },
        attributes: ["id", "courseId", "chapterId", "type"],
        transaction,
      })
    : null;
  if (!resource) throw new NotFoundError("Resource not found");
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
  const progress = await progressOf(viewer, resource, transaction);
  const milestones = created ? await awardMilestones(viewer, resource.courseId, transaction) : [];
  const counted = created && (COUNTED_TYPES as readonly string[]).includes(resource.type);
  const rewards: Rewards = {
    milestones,
    chapterFinished: counted && progress.chapter?.finished ? await chapterReward(progress.chapter, resource.courseId, transaction) : null,
    courseFinished: counted && progress.course.finished ? await courseReward(progress, resource.courseId, transaction) : null,
  };
  return { created, progress, rewards };
}

// The chapter celebration: the next chapter is the first one after it with a counted published file.
async function chapterReward(
  chapter: NonNullable<Progress["chapter"]>,
  courseId: string,
  transaction: Transaction,
): Promise<NonNullable<Rewards["chapterFinished"]>> {
  const { sequelize } = getDb();
  const [next] = await sequelize.query<{ position: number; title: string }>(
    `SELECT ch.position, ch.title FROM chapters ch
     WHERE ch.course_id = $1 AND ch.position > $2
       AND EXISTS (SELECT 1 FROM resources r WHERE r.chapter_id = ch.id AND r.is_published AND r.type = ANY($3::text[]))
     ORDER BY ch.position LIMIT 1`,
    { bind: [courseId, chapter.position, [...COUNTED_TYPES]], type: QueryTypes.SELECT, transaction },
  );
  return { position: chapter.position, title: chapter.title, nextChapter: next ? { position: next.position, title: next.title } : null };
}

async function courseReward(progress: Progress, courseId: string, transaction: Transaction): Promise<NonNullable<Rewards["courseFinished"]>> {
  const course = await getDb().Course.findByPk(courseId, { attributes: ["title"], transaction, rejectOnEmpty: true });
  return { code: progress.course.code, title: course.title, filesTotal: progress.course.total, exams: progress.exams };
}

// Earns the milestones this new completion made true, in the mark's transaction. Chapter, course
// and exam milestones are evaluated only within the marked file's course, on purpose: a mark can
// only complete something there, so the check stays cheap. The insert ignores milestones already
// earned (and a concurrent duplicate), so the keys it returns are exactly the ones earned now.
// Milestones are never removed, by un-marking or by content changes.
async function awardMilestones(viewer: NonNullable<Viewer>, courseId: string, transaction: Transaction): Promise<MilestoneKey[]> {
  const { sequelize } = getDb();
  const [facts] = await sequelize.query<{ files: string; chapter_done: boolean; course_done: boolean; exams_done: boolean }>(
    `WITH mine AS (
       SELECT r.course_id, r.chapter_id, r.type, (c.id IS NOT NULL) AS done
       FROM resources r
       LEFT JOIN completions c ON c.resource_id = r.id AND c.user_id = $1
       WHERE r.is_published AND r.type = ANY($2::text[])
     ), chapters AS (
       SELECT chapter_id, count(*) AS total, count(*) FILTER (WHERE done) AS done
       FROM mine WHERE course_id = $3 AND chapter_id IS NOT NULL AND type = ANY($4::text[])
       GROUP BY chapter_id
     )
     SELECT
       (SELECT count(*) FROM mine WHERE done) AS files,
       EXISTS (SELECT 1 FROM chapters WHERE total = done) AS chapter_done,
       (SELECT count(*) >= 1 AND count(*) = count(*) FILTER (WHERE done) FROM mine WHERE course_id = $3 AND type = ANY($4::text[])) AS course_done,
       (SELECT count(*) >= 1 AND count(*) = count(*) FILTER (WHERE done) FROM mine WHERE course_id = $3 AND type = 'exam') AS exams_done`,
    { bind: [viewer.id, [...MARKABLE_TYPES], courseId, [...COUNTED_TYPES]], type: QueryTypes.SELECT, transaction },
  );
  const files = Number(facts.files);
  const reached: Record<MilestoneKey, boolean> = {
    first_file: files >= 1,
    files_10: files >= 10,
    files_50: files >= 50,
    first_chapter: facts.chapter_done,
    first_course: facts.course_done,
    all_exams_of_course: facts.exams_done,
  };
  const keys = MILESTONE_KEYS.filter((key) => reached[key]);
  if (keys.length === 0) return [];
  const earned = await sequelize.query<{ key: MilestoneKey }>(
    `INSERT INTO milestones (user_id, key) SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING RETURNING key`,
    { bind: [viewer.id, keys], type: QueryTypes.SELECT, transaction },
  );
  const got = new Set(earned.map((row) => row.key));
  return MILESTONE_KEYS.filter((key) => got.has(key));
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
  const [activeDays, hasCompletions, earnedAt] = await Promise.all([
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
    sequelize
      .query<{ key: MilestoneKey; earned_at: Date }>(`SELECT key, earned_at FROM milestones WHERE user_id = $1`, {
        bind: [viewer.id],
        type: QueryTypes.SELECT,
      })
      .then((rows) => new Map(rows.map((row) => [row.key, row.earned_at.toISOString()]))),
  ]);
  const week = { start, today: beirutDate(now), activeDays };
  const milestones = MILESTONE_KEYS.map((key) => ({ key, label: MILESTONE_LABELS[key], earnedAt: earnedAt.get(key) ?? null }));
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
  if (courseIds.length === 0) return { courses: [], week, hasCompletions, milestones };
  const [courses, chapters] = await Promise.all([
    Course.findAll({ where: { id: courseIds }, attributes: ["id", "code", "title", "semester"], order: [["semester", "ASC"], ["code", "ASC"]] }),
    Chapter.findAll({ where: { courseId: courseIds }, attributes: ["id", "courseId", "position", "title"], order: [["position", "ASC"]] }),
  ]);
  return {
    week,
    hasCompletions,
    milestones,
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
