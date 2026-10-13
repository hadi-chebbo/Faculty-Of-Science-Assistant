import { col, fn, Op, type Transaction } from "sequelize";
import { CHAPTER_COUNT_MAX } from "@/db/constants";
import { getDb } from "@/db/models";
import { requireCurrentAdmin } from "../auth/require-admin";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { chapterInputSchema, idSchema, type ChapterInput } from "./schemas";
import type { AdminChapter, AdminChapterWithCount } from "./types";

async function chaptersOf(courseId: string, transaction?: Transaction): Promise<AdminChapter[]> {
  const rows = await getDb().Chapter.findAll({ where: { courseId }, order: [["position", "ASC"]], transaction });
  return rows.map((row) => ({ id: row.id, position: row.position, title: row.title }));
}

async function requireCourse(courseId: string, transaction?: Transaction): Promise<void> {
  const { Course } = getDb();
  const course = idSchema.safeParse(courseId).success
    ? await Course.findByPk(courseId, { attributes: ["id"], transaction, lock: transaction?.LOCK.UPDATE })
    : null;
  if (!course) throw new NotFoundError("Course not found");
}

// Runs `work` in one transaction with the course row locked, so two writes on the same course
// cannot interleave. Returns the course's chapters afterwards.
async function writeChapters(
  courseId: string,
  work: (transaction: Transaction) => Promise<void>,
): Promise<AdminChapter[]> {
  return getDb().sequelize.transaction(async (transaction) => {
    await requireCourse(courseId, transaction);
    await work(transaction);
    return chaptersOf(courseId, transaction);
  });
}

// Gives the chapters positions 1..n in the order of `ids`. The unique (course_id, position)
// constraint is checked row by row, so moving chapters straight to their new positions could
// collide with a chapter that has not moved yet. Step 1 therefore moves every chapter of the
// course to 101..200 (a course has at most 100, so the two ranges never overlap); step 2 then
// sets the final positions, all of which are free.
async function renumber(courseId: string, ids: string[], transaction: Transaction): Promise<void> {
  const { Chapter } = getDb();
  await Chapter.increment({ position: CHAPTER_COUNT_MAX }, { where: { courseId }, transaction });
  for (const [index, id] of ids.entries()) {
    await Chapter.update({ position: index + 1 }, { where: { id }, transaction });
  }
}

export async function listChapters(viewer: Viewer, courseId: string): Promise<AdminChapter[]> {
  await requireCurrentAdmin(viewer);
  await requireCourse(courseId);
  return chaptersOf(courseId);
}

// For the admin chapters page: each chapter with how many resources are filed under it, drafts included.
export async function listChaptersWithCounts(viewer: Viewer, courseId: string): Promise<AdminChapterWithCount[]> {
  await requireCurrentAdmin(viewer);
  await requireCourse(courseId);
  const chapters = await chaptersOf(courseId);
  const counts = await getDb().Resource.findAll({
    attributes: ["chapterId", [fn("count", col("id")), "n"]],
    where: { courseId, chapterId: { [Op.ne]: null } },
    group: ["chapterId"],
    raw: true,
  });
  const byChapter = new Map(counts.map((row) => [String(row.chapterId), Number((row as unknown as { n: string }).n)]));
  return chapters.map((chapter) => ({ ...chapter, itemCount: byChapter.get(chapter.id) ?? 0 }));
}

// Added at the end.
export async function createChapter(viewer: Viewer, courseId: string, input: ChapterInput): Promise<AdminChapter[]> {
  await requireCurrentAdmin(viewer);
  const { title } = parseInput(chapterInputSchema, input);
  return writeChapters(courseId, async (transaction) => {
    const count = await getDb().Chapter.count({ where: { courseId }, transaction });
    if (count >= CHAPTER_COUNT_MAX) throw new ValidationError(["chapters"]);
    await getDb().Chapter.create({ courseId, position: count + 1, title }, { transaction });
  });
}

export async function renameChapter(viewer: Viewer, chapterId: string, input: ChapterInput): Promise<AdminChapter[]> {
  await requireCurrentAdmin(viewer);
  const { title } = parseInput(chapterInputSchema, input);
  const { Chapter } = getDb();
  const courseId = await courseOfChapter(chapterId);
  return writeChapters(courseId, async (transaction) => {
    const [updated] = await Chapter.update({ title }, { where: { id: chapterId }, transaction });
    if (updated === 0) throw new NotFoundError("Chapter not found");
  });
}

// `chapterIds` must be exactly the course's chapters, each once, in the new order.
export async function reorderChapters(viewer: Viewer, courseId: string, chapterIds: string[]): Promise<AdminChapter[]> {
  await requireCurrentAdmin(viewer);
  return writeChapters(courseId, async (transaction) => {
    const current = await chaptersOf(courseId, transaction);
    const valid =
      Array.isArray(chapterIds) &&
      chapterIds.length === current.length &&
      new Set(chapterIds).size === current.length &&
      chapterIds.every((id) => current.some((chapter) => chapter.id === id));
    if (!valid) throw new ValidationError(["chapterIds"]);
    await renumber(courseId, chapterIds, transaction);
  });
}

// Its resources stay: the foreign key sets their chapter to null.
export async function deleteChapter(viewer: Viewer, chapterId: string): Promise<AdminChapter[]> {
  await requireCurrentAdmin(viewer);
  const courseId = await courseOfChapter(chapterId);
  return writeChapters(courseId, async (transaction) => {
    const { Chapter } = getDb();
    if ((await Chapter.destroy({ where: { id: chapterId }, transaction })) === 0) {
      throw new NotFoundError("Chapter not found");
    }
    const rest = await chaptersOf(courseId, transaction);
    await renumber(courseId, rest.map((chapter) => chapter.id), transaction);
  });
}

// Which course a chapter belongs to, so the write can lock that course first.
async function courseOfChapter(chapterId: string): Promise<string> {
  const row = idSchema.safeParse(chapterId).success
    ? await getDb().Chapter.findByPk(chapterId, { attributes: ["courseId"] })
    : null;
  if (!row) throw new NotFoundError("Chapter not found");
  return row.courseId;
}
