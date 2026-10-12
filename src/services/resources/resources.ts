import { Op, Sequelize, type Order, type WhereOptions } from "sequelize";
import { getDb } from "@/db/models";
import type { Resource } from "@/db/models";
import { NotFoundError } from "../errors";
import { visibleResources } from "../visibility";
import { isAdmin, type Viewer } from "../viewer";
import { idSchema, type ResourceFilters } from "./schemas";
import type { ResourceDetail, ResourceListItem, ResourceRef } from "./types";

// Newest academic year first, then partial, final, second, then title.
const LIST_ORDER: Order = [
  ["academicYearStart", "DESC NULLS LAST"],
  [
    Sequelize.literal(
      `CASE "Resource"."exam_session" WHEN 'partial' THEN 1 WHEN 'final' THEN 2 WHEN 'second' THEN 3 ELSE 4 END`,
    ),
    "ASC",
  ],
  ["title", "ASC"],
];

export function toResourceListItem(resource: Resource, courseCode: string): ResourceListItem {
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
  };
}

function toRef(resource: Resource): ResourceRef {
  return { id: resource.id, type: resource.type, title: resource.title };
}

export async function listResources(viewer: Viewer, filters: ResourceFilters = {}): Promise<ResourceListItem[]> {
  const { Resource, Course, sequelize } = getDb();

  const where: WhereOptions[] = [visibleResources(viewer)];
  if (filters.type) where.push({ type: filters.type });
  if (filters.academicYearStart !== undefined) where.push({ academicYearStart: filters.academicYearStart });
  if (filters.examSession) where.push({ examSession: filters.examSession });
  if (filters.language) where.push({ language: filters.language });

  const rows = await Resource.findAll({
    where: { [Op.and]: where },
    include: [
      {
        model: Course,
        as: "course",
        attributes: ["code"],
        required: true,
        // Course codes are unique regardless of letter case, so match the same way.
        where: filters.courseCode
          ? sequelize.where(sequelize.fn("lower", sequelize.col("course.code")), filters.courseCode.trim().toLowerCase())
          : undefined,
      },
    ],
    order: LIST_ORDER,
  });

  return rows.map((row) => toResourceListItem(row, row.course!.code));
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
    ...toResourceListItem(row, row.course!.code),
    courseTitle: row.course!.title,
    solutionOf: row.solutionOf && visible(row.solutionOf) ? toRef(row.solutionOf) : null,
    solutions: (row.solutions ?? []).filter(visible).map(toRef),
  };
}
