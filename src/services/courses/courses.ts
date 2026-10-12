import { fn, col } from "sequelize";
import { RESOURCE_TYPES } from "@/db/constants";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import { toResourceListItem } from "../resources/resources";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";
import type { CourseDetail, CourseSummary } from "./types";

export async function listCoursesBySemester(viewer: Viewer, semester: number): Promise<CourseSummary[]> {
  const { Course, Resource } = getDb();

  const courses = await Course.findAll({ where: { semester }, order: [["code", "ASC"]] });
  if (courses.length === 0) return [];

  // One grouped query for all counts, using the same visibility rule as the lists.
  const counts = (await Resource.findAll({
    attributes: ["courseId", [fn("count", col("id")), "count"]],
    where: { courseId: courses.map((c) => c.id), ...visibleResources(viewer) },
    group: ["courseId"],
    raw: true,
  })) as unknown as { courseId: string; count: string }[];
  const countByCourse = new Map(counts.map((c) => [c.courseId, Number(c.count)]));

  return courses.map((c) => ({
    id: c.id,
    code: c.code,
    title: c.title,
    semester: c.semester,
    resourceCount: countByCourse.get(c.id) ?? 0,
  }));
}

export async function getCourseByCode(viewer: Viewer, code: string): Promise<CourseDetail> {
  const { Course, Resource, sequelize } = getDb();

  // Course codes are unique regardless of letter case.
  const course = await Course.findOne({
    where: sequelize.where(fn("lower", col("code")), code.trim().toLowerCase()),
  });
  if (!course) throw new NotFoundError("Course not found");

  const resources = await Resource.findAll({
    where: { courseId: course.id, ...visibleResources(viewer) },
    order: [
      ["academicYearStart", "DESC NULLS LAST"],
      ["title", "ASC"],
    ],
  });

  const groups = RESOURCE_TYPES.map((type) => ({
    type,
    resources: resources.filter((r) => r.type === type).map((r) => toResourceListItem(r, course.code)),
  })).filter((g) => g.resources.length > 0);

  return { id: course.id, code: course.code, title: course.title, semester: course.semester, groups };
}
