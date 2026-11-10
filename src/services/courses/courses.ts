import { fn, col } from "sequelize";
import { RESOURCE_TYPES } from "@/db/constants";
import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import { lecturerInclude, resourceOrder, toResourceListItem, visibleSolutionsOf } from "../resources/resources";
import { parseInput } from "../validation";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";
import { courseCodeSchema, semesterSchema } from "./schemas";
import type { ResourceListItem } from "../resources/types";
import { lecturerSlugSchema } from "../lecturers/schemas";
import type { LecturerRef } from "../lecturers/types";
import type {
  ChapterPage,
  CourseDetail,
  CourseOption,
  CourseOutline,
  CourseSummary,
  LecturerCount,
  ResourceGroup,
} from "./types";

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

interface CourseData {
  course: { id: string; code: string; title: string; semester: number };
  resources: Awaited<ReturnType<typeof loadResources>>;
  solutions: Awaited<ReturnType<typeof visibleSolutionsOf>>;
  chapters: { id: string; position: number; title: string }[];
}

async function loadResources(viewer: Viewer, courseId: string) {
  return getDb().Resource.findAll({
    where: { courseId, ...visibleResources(viewer) },
    include: [lecturerInclude()],
    order: resourceOrder(),
  });
}

async function loadCourse(viewer: Viewer, code: string): Promise<CourseData> {
  // A blank or over-long code can never match a course; answer the same as for a missing one.
  const parsedCode = courseCodeSchema.safeParse(code);
  if (!parsedCode.success) throw new NotFoundError("Course not found");

  const { Course, Chapter, sequelize } = getDb();

  // Course codes are unique regardless of letter case.
  const course = await Course.findOne({
    where: sequelize.where(fn("lower", col("code")), parsedCode.data.toLowerCase()),
  });
  if (!course) throw new NotFoundError("Course not found");

  const resources = await loadResources(viewer, course.id);
  const solutions = await visibleSolutionsOf(viewer, resources.map((r) => r.id));
  const chapters = await Chapter.findAll({ where: { courseId: course.id }, order: [["position", "ASC"], ["id", "ASC"]] });
  return { course, resources, solutions, chapters };
}

type LoadedResource = CourseData["resources"][number];

// The lecturer strip for a set of published files: who taught them and how many each (solutions
// included), and how many files there are in all (files with no lecturer included).
function lecturerStats(resources: LoadedResource[]): { lecturers: LecturerCount[]; allFileCount: number } {
  const bySlug = new Map<string, LecturerCount>();
  for (const r of resources) {
    if (!r.lecturer) continue;
    const entry = bySlug.get(r.lecturer.slug) ?? { slug: r.lecturer.slug, name: r.lecturer.name, fileCount: 0 };
    entry.fileCount += 1;
    bySlug.set(r.lecturer.slug, entry);
  }
  const lecturers = [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return { lecturers, allFileCount: resources.length };
}

// An unusable or unknown slug (or one whose files are all drafts) is treated as none.
function resolveLecturer(courseResources: LoadedResource[], raw: string | undefined): LecturerRef | null {
  const parsed = raw === undefined ? null : lecturerSlugSchema.safeParse(raw);
  if (!parsed?.success) return null;
  const found = courseResources.find((r) => r.lecturer?.slug === parsed.data)?.lecturer;
  return found ? { slug: found.slug, name: found.name } : null;
}

function buildContent(data: CourseData, lecturer: LecturerRef | null) {
  const { course, resources, solutions, chapters } = data;
  const kept = lecturer ? resources.filter((r) => r.lecturer?.slug === lecturer.slug) : resources;
  const keptIds = new Set(kept.map((r) => r.id));
  const item = (r: LoadedResource) => toResourceListItem(r, course.code, solutions.get(r.id) ?? []);

  const groups = RESOURCE_TYPES.map((type) => ({
    type,
    resources: kept.filter((r) => r.type === type).map(item),
  })).filter((g) => g.resources.length > 0);

  const chapterIds = new Set(chapters.map((c) => c.id));
  const inChapter = new Map<string, ResourceListItem[]>();
  const general: ResourceListItem[] = [];
  const exams: ResourceListItem[] = [];
  for (const r of kept) {
    if (r.type === "exam") {
      exams.push(item(r));
      continue;
    }
    // A solution linked to a listed resource already shows as a link on that resource's row.
    if (r.type === "solution" && r.solutionOfId && keptIds.has(r.solutionOfId)) continue;
    // A chapter of another course (should never happen) counts as no chapter.
    if (r.chapterId && chapterIds.has(r.chapterId)) {
      const list = inChapter.get(r.chapterId) ?? [];
      list.push(item(r));
      inChapter.set(r.chapterId, list);
    } else {
      general.push(item(r));
    }
  }

  const outline: CourseOutline = {
    // With a lecturer applied, chapters left with none of their files are left out.
    chapters: chapters
      .map((c) => {
        const items = inChapter.get(c.id) ?? [];
        return { id: c.id, position: c.position, title: c.title, itemCount: items.length, groups: groupByType(items) };
      })
      .filter((c) => !lecturer || c.itemCount > 0),
    general: groupByType(general),
    exams,
  };
  return { groups, outline };
}

export async function getCourseByCode(
  viewer: Viewer,
  code: string,
  options: { lecturer?: string } = {},
): Promise<CourseDetail> {
  const data = await loadCourse(viewer, code);
  const lecturer = resolveLecturer(data.resources, options.lecturer);
  const { groups, outline } = buildContent(data, lecturer);
  return {
    code: data.course.code,
    title: data.course.title,
    semester: data.course.semester,
    groups,
    outline,
    hasChapters: data.chapters.length > 0,
    hasOtherMaterial: (lecturer ? buildContent(data, null).outline : outline).general.length > 0,
    lecturer,
    ...lecturerStats(data.resources),
  };
}

// The position is the chapter number from the URL; anything that is not a whole number is not found.
export async function getChapterPage(
  viewer: Viewer,
  code: string,
  position: number | string,
  options: { lecturer?: string } = {},
): Promise<ChapterPage> {
  const data = await loadCourse(viewer, code);
  const wanted = typeof position === "string" ? (/^\d+$/.test(position) ? Number(position) : NaN) : position;
  const chapterRow = data.chapters.find((c) => c.position === wanted);
  if (!chapterRow) throw new NotFoundError("Chapter not found");

  const lecturer = resolveLecturer(data.resources, options.lecturer);
  const { outline } = buildContent(data, lecturer);
  const listed = outline.chapters.filter((c) => c.itemCount > 0);
  const current = outline.chapters.find((c) => c.id === chapterRow.id);

  const link = (c: { position: number; title: string } | undefined) => (c ? { position: c.position, title: c.title } : null);
  return {
    course: { code: data.course.code, title: data.course.title, semester: data.course.semester },
    chapter: { position: chapterRow.position, title: chapterRow.title, groups: current?.groups ?? [] },
    previous: link(listed.filter((c) => c.position < chapterRow.position).pop()),
    next: link(listed.find((c) => c.position > chapterRow.position)),
    lecturer,
    ...lecturerStats(data.resources.filter((r) => r.chapterId === chapterRow.id)),
  };
}

// Study order (RESOURCE_TYPES); only types that have rows.
function groupByType(items: ResourceListItem[]): ResourceGroup[] {
  return RESOURCE_TYPES.map((type) => ({ type, resources: items.filter((i) => i.type === type) })).filter(
    (g) => g.resources.length > 0,
  );
}
