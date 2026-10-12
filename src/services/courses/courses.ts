import { fn, col } from "sequelize";
import { RESOURCE_TYPES } from "@/db/constants";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import { resourceOrder, toResourceListItem, visibleSolutionsOf } from "../resources/resources";
import { parseInput } from "../validation";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";
import { courseCodeSchema, semesterSchema } from "./schemas";
import type { CourseDetail, CourseOption, CourseSummary } from "./types";

export async function listCoursesBySemester(viewer: Viewer, semester: number): Promise<CourseSummary[]> {
  const parsedSemester = parseInput(semesterSchema, semester);
  const { Course, Resource } = getDb();

  const courses = await Course.findAll({ where: { semester: parsedSemester }, order: [["code", "ASC"]] });
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
    code: c.code,
    title: c.title,
    semester: c.semester,
    resourceCount: countByCourse.get(c.id) ?? 0,
  }));
}

// Every course, for the admin course filter and the resource form (which stores a course by id).
// Courses are not secret, so the viewer does not change the result.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function listCourses(_viewer: Viewer): Promise<CourseOption[]> {
  const { Course } = getDb();
  const courses = await Course.findAll({ order: [["code", "ASC"]] });
  return courses.map((c) => ({ id: c.id, code: c.code, title: c.title, semester: c.semester }));
}

export async function getCourseByCode(viewer: Viewer, code: string): Promise<CourseDetail> {
  // A blank or over-long code can never match a course; answer the same as for a missing one.
  const parsedCode = courseCodeSchema.safeParse(code);
  if (!parsedCode.success) throw new NotFoundError("Course not found");

  const { Course, Resource, sequelize } = getDb();

  // Course codes are unique regardless of letter case.
  const course = await Course.findOne({
    where: sequelize.where(fn("lower", col("code")), parsedCode.data.toLowerCase()),
  });
  if (!course) throw new NotFoundError("Course not found");

  const resources = await Resource.findAll({
    where: { courseId: course.id, ...visibleResources(viewer) },
    order: resourceOrder(),
  });

  const solutions = await visibleSolutionsOf(viewer, resources.map((r) => r.id));

  const groups = RESOURCE_TYPES.map((type) => ({
    type,
    resources: resources
      .filter((r) => r.type === type)
      .map((r) => toResourceListItem(r, course.code, solutions.get(r.id) ?? [])),
  })).filter((g) => g.resources.length > 0);

  return { code: course.code, title: course.title, semester: course.semester, groups };
}
