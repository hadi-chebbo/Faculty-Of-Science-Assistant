import { Op } from "sequelize";
import { EXAM_SESSIONS } from "@/db/constants";
import type { ExamSession } from "@/db/constants";
import { getDb } from "@/db/models";
import { requireCurrentAdmin } from "../auth/require-admin";
import type { Viewer } from "../viewer";

// An exercise or exam a solution can answer, with the course it belongs to, for the admin form.
export interface SolutionTarget {
  id: string;
  courseId: string;
  type: "exercise" | "exam";
  title: string;
  academicYearStart: number | null;
  examSession: ExamSession | null;
}

const compare = <T extends string | number>(a: T, b: T) => (a < b ? -1 : a > b ? 1 : 0);
const sessionRank = (session: ExamSession | null) => (session ? EXAM_SESSIONS.indexOf(session) : EXAM_SESSIONS.length);

// Every exercise and exam of every course, drafts included. Ordered by course, then exercises (by
// title) before exams (newest year first, then partial, final, second).
export async function listSolutionTargets(viewer: Viewer): Promise<SolutionTarget[]> {
  await requireCurrentAdmin(viewer);
  const rows = await getDb().Resource.findAll({
    where: { type: { [Op.in]: ["exercise", "exam"] } },
    attributes: ["id", "courseId", "type", "title", "academicYearStart", "examSession"],
  });
  const targets = rows.map(
    (row): SolutionTarget => ({
      id: row.id,
      courseId: row.courseId,
      type: row.type === "exam" ? "exam" : "exercise",
      title: row.title,
      academicYearStart: row.academicYearStart,
      examSession: row.examSession,
    }),
  );
  return targets.sort(
    (a, b) =>
      compare(a.courseId, b.courseId) ||
      compare(a.type === "exercise" ? 0 : 1, b.type === "exercise" ? 0 : 1) ||
      (a.type === "exam" ? compare(b.academicYearStart ?? -1, a.academicYearStart ?? -1) || compare(sessionRank(a.examSession), sessionRank(b.examSession)) : 0) ||
      compare(a.title, b.title) ||
      compare(a.id, b.id),
  );
}
