import { Op, Sequelize, type Order, type WhereOptions } from "sequelize";
import { EXAM_SESSIONS } from "@/db/constants";
import { getDb } from "@/db/models";
import type { Resource } from "@/db/models";
import { NotFoundError, UnavailableError } from "../errors";
import type { Page } from "../types";
import { parseInput } from "../validation";
import { visibleResources } from "../visibility";
import { isAdmin, type Viewer } from "../viewer";
import { idSchema, resourceFiltersSchema, type ResourceFilters } from "./schemas";
import type { ResourceDetail, ResourceLink, ResourceListItem, ResourceRef } from "./types";

// Newest academic year first, then sessions in the order of EXAM_SESSIONS (partial, final,
// second), then title. The id is only a tie-breaker so paging is stable when titles repeat.
// The session column is named from the model, so the expression follows a rename.
export function resourceOrder(): Order {
  const { Resource } = getDb();
  const column = `"${Resource.name}"."${Resource.getAttributes().examSession.field}"`;
  const cases = EXAM_SESSIONS.map((session, index) => `WHEN '${session}' THEN ${index}`).join(" ");
  return [
    ["academicYearStart", "DESC NULLS LAST"],
    [Sequelize.literal(`CASE ${column} ${cases} ELSE ${EXAM_SESSIONS.length} END`), "ASC"],
    ["title", "ASC"],
    ["id", "ASC"],
  ];
}

export function toResourceListItem(resource: Resource, courseCode: string, solutions: ResourceRef[]): ResourceListItem {
  return {
    id: resource.id,
    courseCode,
    type: resource.type,
    title: resource.title,
    description: resource.description ?? null,
    academicYearStart: resource.academicYearStart ?? null,
    examSession: resource.examSession ?? null,
    language: resource.language,
    isPublished: resource.isPublished,
    solutions,
  };
}

function toRef(resource: Resource): ResourceRef {
  return { id: resource.id, type: resource.type, title: resource.title };
}

// The solutions the viewer may see, for many resources at once (one query, so no N+1). Done
// apart from the main query because a hasMany include would multiply rows and break paging.
export async function visibleSolutionsOf(viewer: Viewer, ids: string[]): Promise<Map<string, ResourceRef[]>> {
  const byResource = new Map<string, ResourceRef[]>();
  if (ids.length === 0) return byResource;

  const { Resource } = getDb();
  const solutions = await Resource.findAll({
    where: { solutionOfId: ids, ...visibleResources(viewer) },
    order: [["title", "ASC"], ["id", "ASC"]],
  });
  for (const solution of solutions) {
    const list = byResource.get(solution.solutionOfId!) ?? [];
    list.push(toRef(solution));
    byResource.set(solution.solutionOfId!, list);
  }
  return byResource;
}

export async function listResources(viewer: Viewer, filters: ResourceFilters = {}): Promise<Page<ResourceListItem>> {
  const { courseCode, type, academicYearStart, examSession, language, page, pageSize } = parseInput(
    resourceFiltersSchema,
    filters,
  );
  const { Resource, Course, sequelize } = getDb();

  const where: WhereOptions[] = [visibleResources(viewer)];
  if (type) where.push({ type });
  if (academicYearStart !== undefined) where.push({ academicYearStart });
  if (examSession) where.push({ examSession });
  if (language) where.push({ language });

  const { rows, count } = await Resource.findAndCountAll({
    where: { [Op.and]: where },
    include: [
      {
        model: Course,
        as: "course",
        attributes: ["code"],
        required: true,
        // Course codes are unique regardless of letter case, so match the same way.
        where: courseCode
          ? sequelize.where(sequelize.fn("lower", sequelize.col("course.code")), courseCode.toLowerCase())
          : undefined,
      },
    ],
    order: resourceOrder(),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const solutions = await visibleSolutionsOf(viewer, rows.map((row) => row.id));
  return {
    items: rows.map((row) => toResourceListItem(row, row.course!.code, solutions.get(row.id) ?? [])),
    total: count,
    page,
    pageSize,
  };
}

export async function getResource(viewer: Viewer, id: string): Promise<ResourceDetail> {
  // A malformed id can never match a row; answer the same as for a missing one.
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");

  const { Resource, Course } = getDb();
  const row = await Resource.findOne({
    where: { id, ...visibleResources(viewer) },
    include: [
      { model: Course, as: "course", attributes: ["code", "title"], required: true },
      { model: Resource, as: "solutionOf" },
      { model: Resource, as: "solutions" },
    ],
  });
  if (!row) throw new NotFoundError("Resource not found");

  const visible = (r: Resource) => isAdmin(viewer) || r.isPublished;
  return {
    ...toResourceListItem(row, row.course!.code, (row.solutions ?? []).filter(visible).map(toRef)),
    courseTitle: row.course!.title,
    solutionOf: row.solutionOf && visible(row.solutionOf) ? toRef(row.solutionOf) : null,
  };
}

// Where to send a visitor who opens a resource. Same visibility rule as everything else.
export async function getResourceLink(viewer: Viewer, id: string): Promise<ResourceLink> {
  if (!idSchema.safeParse(id).success) throw new NotFoundError("Resource not found");

  const { Resource } = getDb();
  const row = await Resource.findOne({
    where: { id, ...visibleResources(viewer) },
    attributes: ["externalUrl"],
  });
  if (!row) throw new NotFoundError("Resource not found");

  if (row.externalUrl) return { url: row.externalUrl };
  // Stored files need object storage, which does not exist yet; a draft may have no source at all.
  throw new UnavailableError("This resource is not available yet");
}
