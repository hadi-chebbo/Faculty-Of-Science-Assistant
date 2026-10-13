import { getDb } from "@/db/models";
import { requireCurrentAdmin } from "../auth/require-admin";
import type { Viewer } from "../viewer";

// A chapter with the course it belongs to, for pickers that span all courses.
export interface ChapterOption {
  id: string;
  courseId: string;
  position: number;
  title: string;
}

// Every chapter of every course, ordered by course and then position.
export async function listChapterOptions(viewer: Viewer): Promise<ChapterOption[]> {
  await requireCurrentAdmin(viewer);
  const rows = await getDb().Chapter.findAll({ order: [["courseId", "ASC"], ["position", "ASC"]] });
  return rows.map((row) => ({ id: row.id, courseId: row.courseId, position: row.position, title: row.title }));
}
