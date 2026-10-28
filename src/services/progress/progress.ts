import { Op, QueryTypes, type Transaction } from "sequelize";
import { z } from "zod";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import type { Viewer } from "../viewer";
import { COUNTED_TYPES, MARKABLE_TYPES } from "./markable";
import type { MarkResult, Progress } from "./types";

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
export async function markDone(viewer: NonNullable<Viewer>, resourceId: string): Promise<MarkResult> {
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
    return { created: inserted.length > 0, progress: await progressOf(viewer, resource, transaction) };
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
