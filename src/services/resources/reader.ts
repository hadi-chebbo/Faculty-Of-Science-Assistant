import { getDb } from "@/db/models";
import { NotFoundError } from "../errors";
import { getResource } from "./resources";
import type { ReaderResource } from "./types";

// Everything the reader page shows, for an anonymous visitor: the same visibility rule as the
// rest of the public site, so a draft, an unknown id and a malformed id are all "not found".
// The storage key is never returned, only whether a file exists.
export async function getResourceForReader(id: string): Promise<ReaderResource> {
  const detail = await getResource(null, id);

  const { Resource, Course, Chapter } = getDb();
  const row = await Resource.findByPk(detail.id, {
    attributes: ["courseId", "fileKey", "externalUrl"],
    include: [
      { model: Course, as: "course", attributes: ["semester"], required: true },
      { model: Chapter, as: "chapter", attributes: ["position"], required: false },
    ],
  });
  if (!row) throw new NotFoundError("Resource not found");

  const chapterCount = await Chapter.count({ where: { courseId: row.courseId } });
  return {
    ...detail,
    courseSemester: row.course!.semester,
    chapterPosition: row.chapter?.position ?? null,
    courseHasChapters: chapterCount > 0,
    hasFile: Boolean(row.fileKey),
    backupUrl: row.externalUrl ?? null,
  };
}
