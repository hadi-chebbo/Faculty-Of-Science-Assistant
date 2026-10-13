import type { Transaction } from "sequelize";
import { UPLOAD_CONTENT_TYPE, UPLOAD_MAX_BYTES } from "@/db/constants";
import { getDb } from "@/db/models";
import { getStorage } from "@/lib/storage/config";
import { looksLikePdf } from "@/lib/storage/pdf";
import { verifyUploadTicket } from "@/lib/storage/upload-ticket";
import { requireCurrentAdmin } from "../auth/require-admin";
import { NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { getResource } from "./resources";
import { idSchema, resourceInputSchema, type ResourceInput, type ResourceInputData } from "./schemas";
import type { ResourceDetail, ResourceForEdit } from "./types";

// Removes a stored file after the database no longer refers to it. A failure must not fail the
// request (the row is already saved), so it is logged without the key.
async function removeStoredFile(key: string, resourceId: string): Promise<void> {
  try {
    await getStorage().delete(key);
  } catch (error) {
    console.error("could not delete a stored file of resource", resourceId, error instanceof Error ? error.name : "");
  }
}

// Turns a ticket into the key of an uploaded object that is fit to be attached: a PDF within the
// size limit. An object that fails the inspection is deleted, unless a saved resource already uses
// its key. Anything wrong is a "file" error.
async function acceptUpload(ticket: string): Promise<string> {
  const key = await verifyUploadTicket(ticket);
  if (!key) throw new ValidationError(["file"]);

  const storage = getStorage();
  const info = await storage.stat(key);
  if (!info) throw new ValidationError(["file"]);

  const type = info.contentType?.split(";")[0]?.trim().toLowerCase();
  let acceptable = info.size <= UPLOAD_MAX_BYTES && type === UPLOAD_CONTENT_TYPE;
  if (acceptable) {
    const start = await storage.readStart(key, 8);
    acceptable = start !== null && looksLikePdf(start);
  }
  if (!acceptable) {
    // The upload URL stays valid for a few minutes, so the object under a key that a saved resource
    // already uses could have been overwritten. That file is the resource's: never delete it here.
    const owned = (await getDb().Resource.count({ where: { fileKey: key } })) > 0;
    if (!owned) await storage.delete(key);
    throw new ValidationError(["file"]);
  }
  return key;
}

// The checks that need the database. `resource` is the row being edited, or null when creating.
// All problems are collected so the form can mark every offending field at once.
async function checkAgainstDatabase(
  input: Omit<ResourceInputData, "fileTicket">,
  resource: { id: string; courseId: string; fileKey: string | null } | null,
  newFileKey: string | null,
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

  // An uploaded file belongs to one resource only.
  if (newFileKey) {
    const owners = await Resource.findAll({ where: { fileKey: newFileKey }, attributes: ["id"], transaction });
    if (owners.some((owner) => owner.id !== resource?.id)) fields.push("file");
  }

  // A file and a link may coexist; publishing needs at least one of them.
  const hasFile = newFileKey != null || resource?.fileKey != null;
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
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createResource(viewer: Viewer, input: ResourceInput): Promise<ResourceDetail> {
  const admin = await requireCurrentAdmin(viewer);
  const { fileTicket, ...data } = parseInput(resourceInputSchema, input);
  // The stored object is inspected before the transaction opens, so no lock waits on storage.
  const newFileKey = fileTicket ? await acceptUpload(fileTicket) : null;

  const id = await getDb().sequelize.transaction(async (transaction) => {
    await checkAgainstDatabase(data, null, newFileKey, transaction);
    const { Resource } = getDb();
    return (await Resource.create({ ...data, fileKey: newFileKey }, { transaction })).id;
  });
  return getResource(admin, id);
}

// Replaces every editable field. The stored file is kept unless a new one comes with a ticket;
// then the old object is removed once the update is committed.
export async function updateResource(viewer: Viewer, id: string, input: ResourceInput): Promise<ResourceDetail> {
  const admin = await requireCurrentAdmin(viewer);
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");
  const { fileTicket, ...data } = parseInput(resourceInputSchema, input);
  const newFileKey = fileTicket ? await acceptUpload(fileTicket) : null;

  const replacedKey = await getDb().sequelize.transaction(async (transaction) => {
    const { Resource } = getDb();
    // Locked so the source checks hold until the update is written.
    const row = await Resource.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new NotFoundError("Resource not found");
    const oldKey = row.fileKey ?? null;
    await checkAgainstDatabase(data, { id: row.id, courseId: row.courseId, fileKey: oldKey }, newFileKey, transaction);
    await row.update(newFileKey ? { ...data, fileKey: newFileKey } : data, { transaction });
    return newFileKey && oldKey && oldKey !== newFileKey ? oldKey : null;
  });
  if (replacedKey) await removeStoredFile(replacedKey, id);
  return getResource(admin, id);
}

// Bookmarks and completions go with it; solutions that pointed at it lose the link (foreign keys).
export async function deleteResource(viewer: Viewer, id: string): Promise<void> {
  await requireCurrentAdmin(viewer);
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");

  const { Resource } = getDb();
  const row = await Resource.findByPk(id, { attributes: ["id", "fileKey"] });
  if (!row) throw new NotFoundError("Resource not found");
  const fileKey = row.fileKey ?? null;

  const deleted = await Resource.destroy({ where: { id } });
  if (deleted === 0) throw new NotFoundError("Resource not found");
  if (fileKey) await removeStoredFile(fileKey, id);
}
