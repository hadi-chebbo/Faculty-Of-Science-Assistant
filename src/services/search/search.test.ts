import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CreationAttributes } from "sequelize";
import { getDb, type Resource } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { ValidationError } from "../errors";
import { searchCatalog } from "./search";

const KEY = "resources/sample.pdf";


beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

// Courses: DEMO301 (chapters 1-2), DEMO3011 (a code that starts with another), DEMO302 (chapters
// 1-2, the second empty), DEMO401 (chapter 1) and EMPTY999 (nothing in it).
async function seed() {
  const { Course, Chapter, Resource } = getDb();
  const c301 = await Course.create({ code: "DEMO301", title: "Théorie des graphes", semester: 3 });
  await Course.create({ code: "DEMO3011", title: "Other course", semester: 3 });
  const c302 = await Course.create({ code: "DEMO302", title: "Algorithms", semester: 3 });
  const c401 = await Course.create({ code: "DEMO401", title: "Databases", semester: 4 });
  await Course.create({ code: "EMPTY999", title: "Nothing here", semester: 6 });

  const ch301a = await Chapter.create({ courseId: c301.id, position: 1, title: "Graphes orientés" });
  await Chapter.create({ courseId: c301.id, position: 2, title: "Relations and sets" });
  const ch302a = await Chapter.create({ courseId: c302.id, position: 1, title: "Sorting algorithms" });
  await Chapter.create({ courseId: c302.id, position: 2, title: "Empty chapter" });
  const ch401a = await Chapter.create({ courseId: c401.id, position: 1, title: "The relational model" });

  const published = { isPublished: true, fileKey: KEY } as const;
  // A published file unless the values say otherwise.
  const resource = (values: CreationAttributes<Resource>) => Resource.create({ ...published, ...values });

  const ch301b = await getDb().Chapter.findOne({ where: { courseId: c301.id, position: 2 } });
  await resource({ courseId: c301.id, chapterId: ch301a.id, type: "lecture", title: "Graph lecture", description: "Introduction" });
  await resource({ courseId: c301.id, chapterId: ch301b!.id, type: "notes", title: "Set notes" });
  await resource({ courseId: c301.id, type: "exam", title: "Final exam", examSession: "final", academicYearStart: 2024 });
  await resource({ courseId: c301.id, type: "exam", title: "Final exam 2023", examSession: "final", academicYearStart: 2023 });
  const exercise = await resource({
    courseId: c302.id,
    chapterId: ch302a.id,
    type: "exercise",
    title: "Algorithm exercises",
    description: "Practise every relation between the sets.",
  });
  await resource({ courseId: c302.id, chapterId: ch302a.id, type: "solution", title: "Algorithm exercises solution", solutionOfId: exercise.id });
  await resource({ courseId: c302.id, type: "lecture", title: "Sorting relations", language: "fr" });
  await resource({ courseId: c401.id, chapterId: ch401a.id, type: "notes", title: "Relational algebra notes" });
  await resource({ courseId: c401.id, type: "exam", title: "Partial exam", examSession: "partial", academicYearStart: 2024 });
  await resource({ courseId: c401.id, type: "lecture", title: "Draft relation lecture", isPublished: false, fileKey: null });
  return { c301, c302, c401 };
}

const codes = (outcome: { courses: { items: { code: string }[] } | null }) => outcome.courses?.items.map((c) => c.code);
const titles = (outcome: { files: { items: { resource: { title: string } }[] } | null }) =>
  outcome.files?.items.map((f) => f.resource.title);

describe("the minimum length", () => {
  it("answers 'short' under two characters, after trimming, and searches nothing", async () => {
    await seed();
    for (const query of ["", " ", "a", "  a  ", "é"]) {
      const outcome = await searchCatalog(query);
      expect(outcome.state).toBe("short");
      expect(outcome.courses).toBeNull();
      expect(outcome.chapters).toBeNull();
      expect(outcome.files).toBeNull();
    }
  });

  it("searches from two characters on", async () => {
    await seed();
    const outcome = await searchCatalog("al");
    expect(outcome.state).toBe("results");
    expect(codes(outcome)).toEqual(["DEMO302"]);
  });

  it("refuses a query over 100 characters", async () => {
    await expect(searchCatalog("a".repeat(101))).rejects.toBeInstanceOf(ValidationError);
    await expect(searchCatalog("a".repeat(100))).resolves.toMatchObject({ state: "results" });
  });

  it("finds nothing, without error, for a query of punctuation only", async () => {
    await seed();
    const outcome = await searchCatalog("--");
    expect(outcome).toMatchObject({ state: "results", courses: null, chapters: null, files: null });
  });
});

describe("matching", () => {
  it("ignores case and accents in both directions", async () => {
    await seed();
    expect(codes(await searchCatalog("theorie"))).toEqual(["DEMO301"]);
    expect(codes(await searchCatalog("THÉORIE"))).toEqual(["DEMO301"]);
    expect((await searchCatalog("graphes orientes")).chapters?.items.map((c) => c.title)).toEqual(["Graphes orientés"]);
  });

  it("matches the start of a word", async () => {
    await seed();
    const outcome = await searchCatalog("algo");
    expect(codes(outcome)).toEqual(["DEMO302"]);
    expect(outcome.chapters?.items.map((c) => c.title)).toEqual(["Sorting algorithms"]);
    expect(titles(outcome)).toEqual(["Algorithm exercises", "Algorithm exercises solution"]);
    expect((await searchCatalog("gorithm")).courses).toMatchObject({ total: 0 });
  });

  it("requires every word", async () => {
    await seed();
    expect(codes(await searchCatalog("sample algo"))).toEqual([]);
    expect(titles(await searchCatalog("exam final"))).toEqual(["Final exam", "Final exam 2023"]);
  });

  it("finds a course by a prefix of its code", async () => {
    await seed();
    expect(codes(await searchCatalog("DEMO3"))).toEqual(["DEMO301", "DEMO3011", "DEMO302"]);
    expect(codes(await searchCatalog("demo30"))).toEqual(["DEMO301", "DEMO3011", "DEMO302"]);
  });

  it("finds a course by its code with or without a space", async () => {
    await seed();
    expect(codes(await searchCatalog("DEMO301"))).toEqual(["DEMO301", "DEMO3011"]);
    expect(codes(await searchCatalog("demo 301"))).toEqual(["DEMO301", "DEMO3011"]);
    expect(codes(await searchCatalog("  Demo   401 "))).toEqual(["DEMO401"]);
    expect(codes(await searchCatalog("demo 4 01"))).toEqual(["DEMO401"]);
  });

  it("never fails on characters that mean something to the database", async () => {
    await seed();
    const hostile = [
      "'", "''", "\\", "a & b", "a | b", "!a", "a:*", ":*", "(a)", "((", "a <-> b", "a'; DROP TABLE courses; --", "%_", "{}[]", "ab\u0000cd",
      "𝔘𝔫𝔦𝔠𝔬𝔡𝔢", "😀😀", "a".repeat(100),
    ];
    for (const query of hostile) {
      await expect(searchCatalog(query), query).resolves.toMatchObject({ state: expect.any(String) });
    }
    // The tables are still there.
    expect((await searchCatalog("demo")).courses?.total).toBe(4);
  });

  it("treats LIKE wildcards as plain punctuation", async () => {
    await seed();
    expect((await searchCatalog("demo%")).courses?.total).toBe(4);
    expect((await searchCatalog("%%")).courses).toBeNull();
    // "_" matches any character in LIKE; here it just separates the words "d" and "mo".
    expect((await searchCatalog("d_mo")).courses).toMatchObject({ total: 0 });
  });
});

describe("sections", () => {
  it("returns courses, chapters and files with counts", async () => {
    await seed();
    const outcome = await searchCatalog("graph");
    expect(outcome.courses).toEqual({
      total: 1,
      items: [{ code: "DEMO301", title: "Théorie des graphes", semester: 3, chapterCount: 2, fileCount: 4 }],
    });
    expect(outcome.chapters).toEqual({
      total: 1,
      items: [{ position: 1, title: "Graphes orientés", courseCode: "DEMO301", courseTitle: "Théorie des graphes", fileCount: 1 }],
    });
    expect(titles(outcome)).toEqual(["Graph lecture"]);
  });

  it("describes a file with its chapter, its course and its solutions", async () => {
    await seed();
    const outcome = await searchCatalog("algorithm exercises");
    const hit = outcome.files!.items.find((f) => f.resource.title === "Algorithm exercises")!;
    expect(hit.resource).toMatchObject({ courseCode: "DEMO302", type: "exercise", language: "en" });
    expect(hit.chapterPosition).toBe(1);
    expect(hit.courseHasChapters).toBe(true);
    expect(hit.resource.solutions.map((s) => s.title)).toEqual(["Algorithm exercises solution"]);
    const other = (await searchCatalog("sorting relations")).files!.items[0];
    expect(other.chapterPosition).toBeNull();
    expect(other.courseHasChapters).toBe(true);
    expect((await searchCatalog("partial exam")).files!.items[0].courseHasChapters).toBe(true);
  });

  it("lists only the published files, and no draft by its title", async () => {
    await seed();
    expect(titles(await searchCatalog("relation"))).not.toContain("Draft relation lecture");
    expect((await searchCatalog("draft")).files).toMatchObject({ total: 0 });
  });

  it("counts only published files for a course and a chapter", async () => {
    const { c401 } = await seed();
    await getDb().Resource.create({ courseId: c401.id, type: "notes", title: "Unpublished extra" });
    const outcome = await searchCatalog("databases");
    // Two published files; the unpublished extra and the draft lecture are not counted.
    expect(outcome.courses?.items[0].fileCount).toBe(2);
  });

  it("does not list a chapter that has no published file", async () => {
    const { c401 } = await seed();
    await getDb().Chapter.create({ courseId: c401.id, position: 2, title: "Hidden relation chapter" });
    expect((await searchCatalog("empty chapter")).chapters).toMatchObject({ total: 0 });
    expect((await searchCatalog("hidden")).chapters).toMatchObject({ total: 0 });
    // A chapter whose only file is a draft is hidden too.
    const hidden = await getDb().Chapter.findOne({ where: { title: "Hidden relation chapter" } });
    await getDb().Resource.create({ courseId: c401.id, chapterId: hidden!.id, type: "notes", title: "Draft only" });
    expect((await searchCatalog("hidden")).chapters).toMatchObject({ total: 0 });
  });

  it("still lists a course that has no published file", async () => {
    await seed();
    const outcome = await searchCatalog("nothing");
    expect(outcome.courses?.items[0]).toMatchObject({ code: "EMPTY999", fileCount: 0, chapterCount: 0 });
  });

  it("marks what to highlight", async () => {
    await seed();
    expect((await searchCatalog("Demo 301")).highlight).toEqual(["demo", "301", "demo301"]);
    expect((await searchCatalog("final 2024")).highlight).toEqual([]);
  });
});

describe("ranking", () => {
  it("puts the exact course code first, then a longer code", async () => {
    await seed();
    expect(codes(await searchCatalog("demo301"))).toEqual(["DEMO301", "DEMO3011"]);
  });

  it("puts a title match before a code-only match in courses", async () => {
    const { Course } = getDb();
    await Course.create({ code: "ZZZ101", title: "Intro to demo things", semester: 3 });
    await Course.create({ code: "DEMO101", title: "Plain", semester: 3 });
    expect(codes(await searchCatalog("demo"))).toEqual(["ZZZ101", "DEMO101"]);
  });

  it("puts a title match before a description-only match, whatever the other order", async () => {
    await seed();
    const outcome = await searchCatalog("relation");
    // Title matches first (by title), then the file that only mentions it in its description.
    expect(titles(outcome)).toEqual(["Relational algebra notes", "Sorting relations", "Algorithm exercises"]);
  });

  it("ranks by relevance after the title/description split", async () => {
    const { c401 } = await seed();
    const { Resource } = getDb();
    await Resource.create({
      courseId: c401.id, type: "notes", title: "Zzz first", description: "set set set set set set", isPublished: true, fileKey: KEY,
    });
    await Resource.create({
      courseId: c401.id, type: "notes", title: "Aaa second", description: "a set", isPublished: true, fileKey: KEY,
    });
    // Both match in the description only; the one that says it more often comes first.
    const outcome = await searchCatalog("set");
    expect(titles(outcome)).toEqual(["Set notes", "Zzz first", "Aaa second", "Algorithm exercises"]);
  });

  it("lists exams newest academic year first, then by title", async () => {
    await seed();
    expect(titles(await searchCatalog("exam"))).toEqual(["Final exam", "Partial exam", "Final exam 2023"]);
  });
});

describe("the chips", () => {
  it("'course' shows only courses", async () => {
    await seed();
    const outcome = await searchCatalog("algo", { type: "course" });
    expect(outcome.chip).toBe("course");
    expect(outcome.courses?.total).toBe(1);
    expect(outcome.chapters).toBeNull();
    expect(outcome.files).toBeNull();
  });

  it("'lecture' shows only lectures and notes", async () => {
    await seed();
    const outcome = await searchCatalog("relation", { type: "lecture" });
    expect(outcome.courses).toBeNull();
    expect(outcome.chapters).toBeNull();
    expect(titles(outcome)).toEqual(["Relational algebra notes", "Sorting relations"]);
  });

  it("'exercise' and 'exam' show only their kind", async () => {
    await seed();
    expect(titles(await searchCatalog("algo", { type: "exercise" }))).toEqual(["Algorithm exercises"]);
    expect(titles(await searchCatalog("final", { type: "exam" }))).toEqual(["Final exam", "Final exam 2023"]);
  });

  it("lists solutions and other files only under 'all'", async () => {
    await seed();
    expect(titles(await searchCatalog("algorithm"))).toContain("Algorithm exercises solution");
    for (const type of ["lecture", "exercise", "exam"] as const) {
      expect(titles(await searchCatalog("algorithm", { type })) ?? []).not.toContain("Algorithm exercises solution");
    }
  });

  it("'all' is the same as no chip", async () => {
    await seed();
    expect(await searchCatalog("algo", { type: "all" })).toEqual(await searchCatalog("algo"));
  });
});

describe("filter words", () => {
  it("'final 2024' lists the final exams of 2024-2025 and nothing else", async () => {
    await seed();
    const outcome = await searchCatalog("final 2024");
    expect(outcome.chip).toBe("exam");
    expect(outcome.filters).toEqual({ types: ["exam"], sessions: ["final"], year: 2024 });
    expect(titles(outcome)).toEqual(["Final exam"]);
    expect(outcome.courses).toBeNull();
    expect(outcome.chapters).toBeNull();
    expect(outcome.highlight).toEqual([]);
  });

  it("works in French and with the long form of the year", async () => {
    await seed();
    expect(titles(await searchCatalog("partiel 2024-2025"))).toEqual(["Partial exam"]);
    expect(titles(await searchCatalog("examen partiel 2024/2025"))).toEqual(["Partial exam"]);
    expect(titles(await searchCatalog("rattrapage"))).toEqual([]);
  });

  it("a year alone filters by academic year", async () => {
    await seed();
    expect(titles(await searchCatalog("2023"))).toEqual(["Final exam 2023"]);
  });

  it("a type word selects the chip and the files of that type", async () => {
    await seed();
    const exams = await searchCatalog("exams");
    expect(exams.chip).toBe("exam");
    expect(titles(exams)).toEqual(["Final exam", "Partial exam", "Final exam 2023"]);
    const lectures = await searchCatalog("cours");
    expect(lectures.chip).toBe("lecture");
    // "cours" means lectures; notes have their own word.
    expect(titles(lectures)).toEqual(["Graph lecture", "Sorting relations"]);
    const notes = await searchCatalog("notes");
    expect(notes.chip).toBe("lecture");
    expect(titles(notes)).toEqual(["Relational algebra notes", "Set notes"]);
  });

  it("the remaining words still search courses, chapters and files", async () => {
    await seed();
    const outcome = await searchCatalog("lectures graph");
    expect(outcome.chip).toBe("lecture");
    expect(titles(outcome)).toEqual(["Graph lecture"]);
    // The chip limits the page to files.
    expect(outcome.courses).toBeNull();
  });

  it("solution words filter files to solutions while the chip stays All", async () => {
    await seed();
    const outcome = await searchCatalog("algo corrigé");
    expect(outcome.chip).toBe("all");
    expect(titles(outcome)).toEqual(["Algorithm exercises solution"]);
    expect(codes(outcome)).toEqual(["DEMO302"]);
    expect((await searchCatalog("solution")).chip).toBe("all");
    expect(titles(await searchCatalog("solution"))).toEqual(["Algorithm exercises solution"]);
  });

  it("an explicit chip that contradicts a type word finds no files", async () => {
    await seed();
    const outcome = await searchCatalog("exam", { type: "lecture" });
    expect(outcome.chip).toBe("lecture");
    expect(outcome.files).toBeNull();
  });

  it("an explicit 'all' keeps the filter but not the derived chip", async () => {
    await seed();
    const outcome = await searchCatalog("exam relation", { type: "all" });
    expect(outcome.chip).toBe("all");
    expect(titles(outcome)).toEqual([]);
    expect(outcome.courses?.total).toBe(0);
    const only = await searchCatalog("exam", { type: "all" });
    expect(only.chip).toBe("all");
    // The page needs to know that "all" has to be written into the address to stay All.
    expect(only.impliedChip).toBe("exam");
    expect((await searchCatalog("graph")).impliedChip).toBe("all");
    expect(only.filters.types).toEqual(["exam"]);
    expect(titles(only)).toHaveLength(3);
  });
});

describe("paging a section", () => {
  async function bulk() {
    const { c401 } = await seed();
    const { Resource } = getDb();
    for (let i = 1; i <= 25; i++) {
      await Resource.create({
        courseId: c401.id, type: "other", title: `Bulk zeta file ${String(i).padStart(2, "0")}`, isPublished: true, fileKey: KEY,
      });
    }
  }

  it("shows the top 5 of each section", async () => {
    await bulk();
    const outcome = await searchCatalog("zeta");
    expect(outcome.show).toBeNull();
    expect(outcome.files?.total).toBe(25);
    expect(outcome.files?.items).toHaveLength(5);
    expect(outcome.pages).toBe(1);
  });

  it("'show' expands one section to 20 a page and hides the others", async () => {
    await bulk();
    const first = await searchCatalog("zeta", { show: "files" });
    expect(first.show).toBe("files");
    expect(first.files?.items).toHaveLength(20);
    expect(first.courses).toBeNull();
    expect(first.chapters).toBeNull();
    expect(first).toMatchObject({ page: 1, pages: 2 });
    const second = await searchCatalog("zeta", { show: "files", page: 2 });
    expect(titles(second)).toEqual(["Bulk zeta file 21", "Bulk zeta file 22", "Bulk zeta file 23", "Bulk zeta file 24", "Bulk zeta file 25"]);
    expect(first.files!.items.at(-1)!.resource.title).toBe("Bulk zeta file 20");
  });

  it("brings a page past the end back to the last one", async () => {
    await bulk();
    expect(await searchCatalog("zeta", { show: "files", page: 99 })).toMatchObject({ page: 2, pages: 2 });
  });

  it("ignores 'show' for a section the chip hides", async () => {
    await bulk();
    const outcome = await searchCatalog("zeta", { show: "files", type: "course" });
    expect(outcome.show).toBeNull();
    expect(outcome.files).toBeNull();
  });

  it("expands courses and chapters too", async () => {
    await seed();
    const courses = await searchCatalog("demo", { show: "courses" });
    expect(courses.show).toBe("courses");
    expect(courses.courses?.total).toBe(4);
    expect(courses.files).toBeNull();
    const chapters = await searchCatalog("relation", { show: "chapters" });
    // Equal relevance: by course code.
    expect(chapters.chapters?.items.map((c) => c.title)).toEqual(["Relations and sets", "The relational model"]);
    expect(chapters.files).toBeNull();
  });

  it("refuses an invalid page", async () => {
    await expect(searchCatalog("zeta", { page: 0 })).rejects.toBeInstanceOf(ValidationError);
  });
});
