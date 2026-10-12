import { fn, col } from "sequelize";
import { RESOURCE_TYPES } from "@/db/constants";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import { resourceOrder, toResourceListItem, visibleSolutionsOf } from "../resources/resources";
import { parseInput } from "../validation";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";
import { courseCodeSchema, semesterSchema } from "./schemas";
import type { ResourceListItem } from "../resources/types";
import type { ChapterPage, CourseDetail, CourseOption, CourseOutline, CourseSummary, ResourceGroup } from "./types";

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

  const { Course, Chapter, Resource, sequelize } = getDb();

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

  // The by-chapter outline. Chapters come in one query; the resources are the ones already loaded.
  const chapters = await Chapter.findAll({ where: { courseId: course.id }, order: [["position", "ASC"], ["id", "ASC"]] });
  const chapterIds = new Set(chapters.map((c) => c.id));
  const visibleIds = new Set(resources.map((r) => r.id));

  const inChapter = new Map<string, ResourceListItem[]>();
  const general: ResourceListItem[] = [];
  const exams: ResourceListItem[] = [];
  for (const r of resources) {
    const item = toResourceListItem(r, course.code, solutions.get(r.id) ?? []);
    if (r.type === "exam") {
      exams.push(item);
      continue;
    }
    // A solution linked to a visible resource already shows as a link on that resource's row.
    if (r.type === "solution" && r.solutionOfId && visibleIds.has(r.solutionOfId)) continue;
    // A chapter of another course (should never happen) counts as no chapter.
    if (r.chapterId && chapterIds.has(r.chapterId)) {
      const list = inChapter.get(r.chapterId) ?? [];
      list.push(item);
      inChapter.set(r.chapterId, list);
    } else {
      general.push(item);
    }
  }

  const outline: CourseOutline = {
    chapters: chapters.map((c) => {
      const items = inChapter.get(c.id) ?? [];
      return { id: c.id, position: c.position, title: c.title, itemCount: items.length, groups: groupByType(items) };
    }),
    general: groupByType(general),
    exams,
  };

  return { code: course.code, title: course.title, semester: course.semester, groups, outline };
}

// The position is the chapter number from the URL; anything that is not a whole number is not found.
export async function getChapterPage(viewer: Viewer, code: string, position: number | string): Promise<ChapterPage> {
  const course = await getCourseByCode(viewer, code);
  const wanted = typeof position === "string" ? (/^\d+$/.test(position) ? Number(position) : NaN) : position;
  const chapters = course.outline.chapters;
  const index = chapters.findIndex((c) => c.position === wanted);
  if (index === -1) throw new NotFoundError("Chapter not found");

  const chapter = chapters[index];
  const link = (c: { position: number; title: string } | undefined) => (c ? { position: c.position, title: c.title } : null);
  return {
    course: { code: course.code, title: course.title, semester: course.semester },
    chapter: { position: chapter.position, title: chapter.title, groups: chapter.groups },
    previous: link(chapters.slice(0, index).reverse().find((c) => c.itemCount > 0)),
    next: link(chapters.slice(index + 1).find((c) => c.itemCount > 0)),
  };
}

// Study order (RESOURCE_TYPES); only types that have rows.
function groupByType(items: ResourceListItem[]): ResourceGroup[] {
  return RESOURCE_TYPES.map((type) => ({ type, resources: items.filter((i) => i.type === type) })).filter(
    (g) => g.resources.length > 0,
  );
}
