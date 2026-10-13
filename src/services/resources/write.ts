import type { Transaction } from "sequelize";
import { getDb } from "@/db/models";
import { requireCurrentAdmin } from "../auth/require-admin";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { getResource } from "./resources";
import { idSchema, resourceInputSchema, type ResourceInput, type ResourceInputData } from "./schemas";
import type { ResourceDetail, ResourceForEdit } from "./types";

// The checks that need the database. `resource` is the row being edited, or null when creating.
// All problems are collected so the form can mark every offending field at once.
async function checkAgainstDatabase(
  input: ResourceInputData,
  resource: { id: string; courseId: string; fileKey: string | null } | null,
  transaction: Transaction,
): Promise<void> {
  const { Chapter, Course, Resource } = getDb();
  const fields: string[] = [];

  if (!(await Course.findByPk(input.courseId, { attributes: ["id"], transaction }))) fields.push("courseId");

  if (input.solutionOfId) {
    const target = await Resource.findByPk(input.solutionOfId, { attributes: ["id", "courseId", "type"], transaction });
    const valid =
      target && target.courseId === input.courseId && target.type !== "solution" && target.id !== resource?.id;
    if (!valid) fields.push("solutionOfId");
  }

  if (input.chapterId) {
    const chapter = await Chapter.findByPk(input.chapterId, { attributes: ["id", "courseId"], transaction });
    if (!chapter || chapter.courseId !== input.courseId) fields.push("chapterId");
  }

  const hasFile = resource?.fileKey != null;
  // A file and a link exclude each other.
  if (input.externalUrl && hasFile) fields.push("externalUrl");
  if (input.isPublished && !input.externalUrl && !hasFile) fields.push("isPublished");

  // While solutions point at a resource it cannot move to another course (they must share it)
  // or become a solution itself (a solution never answers a solution).
  const moves = resource !== null && resource.courseId !== input.courseId;
  const becomesSolution = input.type === "solution";
  if (resource && (moves || becomesSolution)) {
    if ((await Resource.count({ where: { solutionOfId: resource.id }, transaction })) > 0) {
      if (moves) fields.push("courseId");
      if (becomesSolution) fields.push("type");
    }
  }

  if (fields.length > 0) throw new ValidationError([...new Set(fields)]);
}

// The stored values of one resource, drafts included, for the admin edit form.
export async function getResourceForEdit(viewer: Viewer, id: string): Promise<ResourceForEdit> {
  await requireCurrentAdmin(viewer);
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");

  const { Resource } = getDb();
  const row = await Resource.findByPk(id);
  if (!row) throw new NotFoundError("Resource not found");
  const target = row.solutionOfId ? await Resource.findByPk(row.solutionOfId, { attributes: ["id", "title"] }) : null;
  const solutionCount = await Resource.count({ where: { solutionOfId: row.id } });

  return {
    id: row.id,
    courseId: row.courseId,
    type: row.type,
    title: row.title,
    description: row.description ?? null,
    academicYearStart: row.academicYearStart ?? null,
    examSession: row.examSession ?? null,
    language: row.language,
    externalUrl: row.externalUrl ?? null,
    isPublished: row.isPublished,
    hasFile: row.fileKey != null,
    chapterId: row.chapterId ?? null,
    solutionOf: target ? { id: target.id, title: target.title } : null,
    solutionCount,
  };
}

export async function createResource(viewer: Viewer, input: ResourceInput): Promise<ResourceDetail> {
  const admin = await requireCurrentAdmin(viewer);
  const data = parseInput(resourceInputSchema, input);

  const id = await getDb().sequelize.transaction(async (transaction) => {
    await checkAgainstDatabase(data, null, transaction);
    const { Resource } = getDb();
    return (await Resource.create(data, { transaction })).id;
  });
  return getResource(admin, id);
}

// Replaces every editable field. The stored file, if any, is never touched.
export async function updateResource(viewer: Viewer, id: string, input: ResourceInput): Promise<ResourceDetail> {
  const admin = await requireCurrentAdmin(viewer);
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");
  const data = parseInput(resourceInputSchema, input);

  await getDb().sequelize.transaction(async (transaction) => {
    const { Resource } = getDb();
    // Locked so the file/link checks hold until the update is written.
    const row = await Resource.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new NotFoundError("Resource not found");
    await checkAgainstDatabase(data, { id: row.id, courseId: row.courseId, fileKey: row.fileKey ?? null }, transaction);
    await row.update(data, { transaction });
  });
  return getResource(admin, id);
}

// Bookmarks and completions go with it; solutions that pointed at it lose the link (foreign keys).
export async function deleteResource(viewer: Viewer, id: string): Promise<void> {
  await requireCurrentAdmin(viewer);
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");

  const deleted = await getDb().Resource.destroy({ where: { id } });
  if (deleted === 0) throw new NotFoundError("Resource not found");
}
