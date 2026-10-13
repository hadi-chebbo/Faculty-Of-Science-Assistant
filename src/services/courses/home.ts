import { fn, col } from "sequelize";
import { SEMESTER_MAX, SEMESTER_MIN } from "@/db/constants";
import { getDb } from "@/db/models";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";

export interface HomeStats {
  totals: { courses: number; chapters: number; resources: number; exams: number };
  // One entry per semester from SEMESTER_MIN to SEMESTER_MAX, in order, including semesters with no course.
  semesters: { semester: number; courseCount: number; resourceCount: number }[];
}

// Numbers for the landing page. Three queries, whatever the amount of data: all courses,
// the chapter count, and visible resources grouped by course and type.
export async function getHomeStats(viewer: Viewer): Promise<HomeStats> {
  const { Course, Chapter, Resource } = getDb();

  const [courses, chapters, groups] = await Promise.all([
    Course.findAll({ attributes: ["id", "semester"], raw: true }),
    Chapter.count(),
    Resource.findAll({
      attributes: ["courseId", "type", [fn("count", col("id")), "count"]],
      where: visibleResources(viewer),
      group: ["courseId", "type"],
      raw: true,
    }) as unknown as Promise<{ courseId: string; type: string; count: string }[]>,
  ]);

  const semesterOfCourse = new Map(courses.map((c) => [c.id, c.semester]));
  const semesters = Array.from({ length: SEMESTER_MAX - SEMESTER_MIN + 1 }, (_, i) => ({
    semester: SEMESTER_MIN + i,
    courseCount: 0,
    resourceCount: 0,
  }));
  const bySemester = new Map(semesters.map((s) => [s.semester, s]));

  for (const c of courses) {
    const entry = bySemester.get(c.semester);
    if (entry) entry.courseCount += 1;
  }

  let resources = 0;
  let exams = 0;
  for (const g of groups) {
    const count = Number(g.count);
    resources += count;
    if (g.type === "exam") exams += count;
    const semester = semesterOfCourse.get(g.courseId);
    const entry = semester === undefined ? undefined : bySemester.get(semester);
    if (entry) entry.resourceCount += count;
  }

  return { totals: { courses: courses.length, chapters, resources, exams }, semesters };
}
