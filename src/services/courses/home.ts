import { fn, col } from "sequelize";
import { YEARS, yearOfSemester, type Year } from "@/lib/years";
import { getDb } from "@/db/models";
import { visibleResources } from "../visibility";
import type { Viewer } from "../viewer";

export interface HomeStats {
  // `examYears`: the first and last academic year start of a visible exam (2015 means 2015-2016), null without one.
  totals: {
    courses: number;
    chapters: number;
    resources: number;
    exams: number;
    examYears: { first: number; last: number } | null;
  };
  // One entry per year in YEARS, in order, including years with no course. Codes are ordered semester, then code.
  years: { year: Year; courseCount: number; resourceCount: number; courseCodes: string[] }[];
}

// Numbers for the landing page. Four queries, whatever the amount of data: all courses, the chapter
// count, visible resources grouped by course and type, and the academic year span of visible exams.
export async function getHomeStats(viewer: Viewer): Promise<HomeStats> {
  const { Course, Chapter, Resource } = getDb();

  const [courses, chapters, groups, span] = await Promise.all([
    Course.findAll({ attributes: ["id", "code", "semester"], order: [["semester", "ASC"], ["code", "ASC"]], raw: true }),
    Chapter.count(),
    Resource.findAll({
      attributes: ["courseId", "type", [fn("count", col("id")), "count"]],
      where: visibleResources(viewer),
      group: ["courseId", "type"],
      raw: true,
    }) as unknown as Promise<{ courseId: string; type: string; count: string }[]>,
    Resource.findOne({
      attributes: [
        [fn("min", col("academic_year_start")), "first"],
        [fn("max", col("academic_year_start")), "last"],
      ],
      where: { ...visibleResources(viewer), type: "exam" },
      raw: true,
    }) as unknown as Promise<{ first: number | null; last: number | null } | null>,
  ]);

  const yearOfCourse = new Map(courses.map((c) => [c.id, yearOfSemester(c.semester)]));
  const years = YEARS.map((year) => ({ year, courseCount: 0, resourceCount: 0, courseCodes: [] as string[] }));
  const byYear = new Map(years.map((y) => [y.year, y]));

  for (const c of courses) {
    const entry = byYear.get(yearOfSemester(c.semester));
    if (!entry) continue;
    entry.courseCount += 1;
    entry.courseCodes.push(c.code);
  }

  let resources = 0;
  let exams = 0;
  for (const g of groups) {
    const count = Number(g.count);
    resources += count;
    if (g.type === "exam") exams += count;
    const year = yearOfCourse.get(g.courseId);
    const entry = year === undefined ? undefined : byYear.get(year);
    if (entry) entry.resourceCount += count;
  }

  const examYears =
    span?.first != null && span.last != null ? { first: Number(span.first), last: Number(span.last) } : null;
  return { totals: { courses: courses.length, chapters, resources, exams, examYears }, years };
}
