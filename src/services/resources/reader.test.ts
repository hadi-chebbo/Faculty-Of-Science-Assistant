import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { NotFoundError } from "../errors";
import { getResourceForReader } from "./reader";

const KEY = "resources/reader-secret-key.pdf";
const LINK = "https://example.com/backup";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function seed() {
  const { Course, Chapter, Resource } = getDb();
  const course = await Course.create({ code: "READ301", title: "Reader course", semester: 4 });
  const chapter = await Chapter.create({ courseId: course.id, position: 2, title: "Second" });
  const lecture = await Resource.create({
    courseId: course.id, chapterId: chapter.id, type: "lecture", title: "Lecture", fileKey: KEY, externalUrl: LINK, isPublished: true,
  });
  const exam = await Resource.create({
    courseId: course.id, type: "exam", title: "Exam", academicYearStart: 2024, examSession: "final", fileKey: KEY, isPublished: true,
  });
  const solution = await Resource.create({
    courseId: course.id, type: "solution", title: "Exam solution", solutionOfId: exam.id, fileKey: KEY, isPublished: true,
  });
  const draftSolution = await Resource.create({
    courseId: course.id, type: "solution", title: "Draft solution", solutionOfId: exam.id, fileKey: KEY,
  });
  const draft = await Resource.create({ courseId: course.id, type: "lecture", title: "Draft", fileKey: KEY });
  return { course, chapter, lecture, exam, solution, draftSolution, draft };
}

describe("getResourceForReader", () => {
  it("returns what the page needs for a published resource of a chapter", async () => {
    const { lecture } = await seed();
    const reader = await getResourceForReader(lecture.id);
    expect(reader).toMatchObject({
      id: lecture.id,
      title: "Lecture",
      type: "lecture",
      courseCode: "READ301",
      courseTitle: "Reader course",
      courseSemester: 4,
      chapterPosition: 2,
      courseHasChapters: true,
      hasFile: true,
      backupUrl: LINK,
    });
  });

  it("gives the backup link as null when there is none, and the solutions of an exam", async () => {
    const { exam, solution } = await seed();
    const reader = await getResourceForReader(exam.id);
    expect(reader.backupUrl).toBeNull();
    expect(reader.chapterPosition).toBeNull();
    expect(reader.academicYearStart).toBe(2024);
    expect(reader.examSession).toBe("final");
    // The draft solution is not offered to an anonymous visitor.
    expect(reader.solutions).toEqual([{ id: solution.id, type: "solution", title: "Exam solution" }]);
  });

  it("points a solution back at its exam", async () => {
    const { exam, solution } = await seed();
    const reader = await getResourceForReader(solution.id);
    expect(reader.solutionOf).toEqual({ id: exam.id, type: "exam", title: "Exam" });
  });

  it("reports a course without chapters", async () => {
    const { Course, Resource } = getDb();
    const course = await Course.create({ code: "READ302", title: "Flat", semester: 3 });
    const notes = await Resource.create({ courseId: course.id, type: "notes", title: "Notes", fileKey: KEY, isPublished: true });
    expect(await getResourceForReader(notes.id)).toMatchObject({ courseHasChapters: false, chapterPosition: null });
  });

  it("never returns the storage key", async () => {
    const { lecture } = await seed();
    const reader = await getResourceForReader(lecture.id);
    expect(JSON.stringify(reader)).not.toContain(KEY);
    expect(reader).not.toHaveProperty("fileKey");
  });

  it("is not found for a draft, an unknown id and a malformed id", async () => {
    const { draft } = await seed();
    for (const id of [draft.id, "33333333-3333-4333-8333-333333333333", "not-a-uuid"]) {
      await expect(getResourceForReader(id)).rejects.toBeInstanceOf(NotFoundError);
    }
  });
});
