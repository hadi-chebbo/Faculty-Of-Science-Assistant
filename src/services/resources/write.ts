import type { Transaction } from "sequelize";
import { getDb } from "@/db/models";
import { getAccount } from "../auth/auth";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { parseInput } from "../validation";
import type { Viewer } from "../viewer";
import { getResource } from "./resources";
import { idSchema, resourceInputSchema, type ResourceInput, type ResourceInputData } from "./schemas";
import type { ResourceDetail } from "./types";

// The token's role can be up to 15 minutes old, so a write checks the role in the database.
// Runs before input validation: an anonymous caller learns nothing about the input rules.
async function requireCurrentAdmin(viewer: Viewer): Promise<NonNullable<Viewer>> {
  const account = await getAccount(viewer);
  if (!viewer || !account || account.role !== "admin") throw new ForbiddenError();
  return { id: account.id, role: account.role };
}

// The checks that need the database. `resource` is the row being edited, or null when creating.
// All problems are collected so the form can mark every offending field at once.
async function checkAgainstDatabase(
  input: ResourceInputData,
  resource: { id: string; courseId: string; fileKey: string | null } | null,
  transaction: Transaction,
): Promise<void> {
  const { Course, Resource } = getDb();
  const fields: string[] = [];

  if (!(await Course.findByPk(input.courseId, { attributes: ["id"], transaction }))) fields.push("courseId");

  if (input.solutionOfId) {
    const target = await Resource.findByPk(input.solutionOfId, { attributes: ["id", "courseId", "type"], transaction });
    const valid =
      target && target.courseId === input.courseId && target.type !== "solution" && target.id !== resource?.id;
    if (!valid) fields.push("solutionOfId");
  }

  const hasFile = resource?.fileKey != null;
  // A file and a link exclude each other.
  if (input.externalUrl && hasFile) fields.push("externalUrl");
  if (input.isPublished && !input.externalUrl && !hasFile) fields.push("isPublished");

  // Moving a resource to another course would break the same-course rule of its solutions.
  if (resource && resource.courseId !== input.courseId) {
    if ((await Resource.count({ where: { solutionOfId: resource.id }, transaction })) > 0) fields.push("courseId");
  }

  if (fields.length > 0) throw new ValidationError(fields);
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
