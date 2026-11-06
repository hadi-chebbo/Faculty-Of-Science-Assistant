import { col, fn, UniqueConstraintError } from "sequelize";
import { z } from "zod";
import { COURSE_TITLE_MAX_LENGTH } from "@/db/constants";
import { getDb } from "@/db/models";
import { requireCurrentAdmin } from "../auth/require-admin";
import { CourseCodeTakenError, NotFoundError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { idSchema } from "../chapters/schemas";
import { semesterSchema } from "./schemas";
import type { AdminCourse } from "./types";

// "i3 301" -> "I3301": trimmed, every whitespace removed, uppercased.
export function normaliseCourseCode(code: string): string {
  return code.replace(/\s+/g, "").toUpperCase();
}

const normalisedCodeSchema = z
  .string()
  .transform(normaliseCourseCode)
  .pipe(z.string().regex(/^[A-Z0-9]{2,20}$/));

export const courseInputSchema = z.object({
  code: normalisedCodeSchema,
  title: z.string().trim().min(1).max(COURSE_TITLE_MAX_LENGTH),
  semester: semesterSchema,
});

export type CourseInput = z.input<typeof courseInputSchema>;
export type CourseChanges = Partial<CourseInput>;
export type SavedCourse = Pick<AdminCourse, "id" | "code" | "title" | "semester">;

const toSaved = (c: SavedCourse): SavedCourse => ({ id: c.id, code: c.code, title: c.title, semester: c.semester });

// Every course with its resource (drafts included) and chapter counts, semester then code.
export async function listAdminCourses(viewer: Viewer): Promise<AdminCourse[]> {
  await requireCurrentAdmin(viewer);
  const { Course, Resource, Chapter } = getDb();
  const [courses, resources, chapters] = await Promise.all([
    Course.findAll({ order: [["semester", "ASC"], ["code", "ASC"]] }),
    Resource.findAll({ attributes: ["courseId", [fn("count", col("id")), "n"]], group: ["courseId"], raw: true }),
    Chapter.findAll({ attributes: ["courseId", [fn("count", col("id")), "n"]], group: ["courseId"], raw: true }),
  ]);
  const toMap = (rows: object[]) =>
    new Map((rows as { courseId: string; n: string }[]).map((r) => [r.courseId, Number(r.n)]));
  const resourceCounts = toMap(resources);
  const chapterCounts = toMap(chapters);
  return courses.map((c) => ({
    ...toSaved(c),
    resourceCount: resourceCounts.get(c.id) ?? 0,
    chapterCount: chapterCounts.get(c.id) ?? 0,
  }));
}

// True when a course other than `exceptId` already has this code, ignoring case.
async function codeTaken(code: string, exceptId?: string): Promise<boolean> {
  const { Course, sequelize } = getDb();
  const rows = await Course.findAll({
    attributes: ["id"],
    where: sequelize.where(fn("lower", col("code")), code.toLowerCase()),
  });
  return rows.some((row) => row.id !== exceptId);
}

export async function createCourse(viewer: Viewer, input: CourseInput): Promise<SavedCourse> {
  await requireCurrentAdmin(viewer);
  const data = parseInput(courseInputSchema, input);
  if (await codeTaken(data.code)) throw new CourseCodeTakenError();
  try {
    return toSaved(await getDb().Course.create(data));
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new CourseCodeTakenError();
    throw error;
  }
}

export async function updateCourse(viewer: Viewer, id: string, input: CourseChanges): Promise<SavedCourse> {
  await requireCurrentAdmin(viewer);
  const changes = parseInput(courseInputSchema.partial(), input);
  const course = idSchema.safeParse(id).success ? await getDb().Course.findByPk(id) : null;
  if (!course) throw new NotFoundError("Course not found");
  if (changes.code !== undefined && (await codeTaken(changes.code, course.id))) throw new CourseCodeTakenError();
  try {
    return toSaved(await course.update(changes));
  } catch (error) {
    if (error instanceof UniqueConstraintError) throw new CourseCodeTakenError();
    throw error;
  }
}
