import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GET as serveStorageRoute } from "@/app/api/v1/storage/local/route";
import { ACADEMIC_YEAR_MIN } from "@/db/constants";
import { getDb } from "@/db/models";
import { closeDb, truncateAllTables } from "@/db/test-utils";
import { getStorage } from "@/lib/storage/config";
import { newResourceFileKey } from "@/lib/storage/keys";
import { ForbiddenError, NotFoundError, UnavailableError, ValidationError } from "../errors";
import { requireAdmin, type Viewer } from "../viewer";
import { getResource, getResourceLink, listExamFilterOptions, listResources } from "./resources";
import { RESOURCE_PAGE_SIZE_DEFAULT, RESOURCE_PAGE_SIZE_MAX } from "./schemas";

const SAMPLE_URL = "https://example.com/sample";
const admin: Viewer = { id: "11111111-1111-4111-8111-111111111111", role: "admin" };
const student: Viewer = { id: "22222222-2222-4222-8222-222222222222", role: "student" };

const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\nstored body");
let storageDir: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "resources-test-secret-0123456789abcdef0123";
  delete process.env.STORAGE_DRIVER;
  delete process.env.VERCEL;
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), "ua-resources-"));
  process.env.STORAGE_LOCAL_DIR = storageDir;
});

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await fs.rm(storageDir, { recursive: true, force: true });
  await closeDb();
});

async function storeFile() {
  const key = newResourceFileKey();
  await getStorage().put(key, PDF_BYTES, "application/pdf");
  return { key };
}

const serveFromStorage = (url: string) => serveStorageRoute(new Request(new URL(url, "http://localhost")));

async function seed() {
  const { Course, Resource } = getDb();
  const a = await Course.create({ code: "TEST301", title: "Course A", semester: 3 });
  const b = await Course.create({ code: "TEST302", title: "Course B", semester: 3 });
  const exam = await Resource.create({
    courseId: a.id, type: "exam", title: "Final 2024", academicYearStart: 2024, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL,
  });
  const partial = await Resource.create({
    courseId: a.id, type: "exam", title: "Partial 2024", academicYearStart: 2024, examSession: "partial", isPublished: true, externalUrl: SAMPLE_URL,
  });
  const old = await Resource.create({
    courseId: a.id, type: "exam", title: "Final 2022", academicYearStart: 2022, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL, language: "fr",
  });
  const solution = await Resource.create({
    courseId: a.id, type: "solution", title: "Final 2024 solution", solutionOfId: exam.id, isPublished: true, externalUrl: SAMPLE_URL,
  });
  const draft = await Resource.create({ courseId: a.id, type: "lecture", title: "Draft lecture" });
  const other = await Resource.create({ courseId: b.id, type: "lecture", title: "Other lecture", isPublished: true, externalUrl: SAMPLE_URL });
  return { a, b, exam, partial, old, solution, draft, other };
}

describe("listResources", () => {
  it("hides drafts from anonymous visitors and students, shows them to an admin", async () => {
    await seed();
    expect((await listResources(null)).items).toHaveLength(5);
    expect((await listResources(student)).items).toHaveLength(5);
    expect((await listResources(admin)).items).toHaveLength(6);
  });

  it("orders newest year first, then partial before final, then title", async () => {
    await seed();
    const titles = (await listResources(null, { type: "exam" })).items.map((r) => r.title);
    expect(titles).toEqual(["Partial 2024", "Final 2024", "Final 2022"]);
  });

  it("filters by each field on its own", async () => {
    await seed();
    expect((await listResources(null, { courseCode: "test302" })).items.map((r) => r.title)).toEqual(["Other lecture"]);
    expect((await listResources(null, { type: "solution" })).items).toHaveLength(1);
    expect((await listResources(null, { academicYearStart: 2022 })).items).toHaveLength(1);
    expect((await listResources(null, { examSession: "partial" })).items).toHaveLength(1);
    expect((await listResources(null, { language: "fr" })).items.map((r) => r.title)).toEqual(["Final 2022"]);
  });

  it("combines filters", async () => {
    await seed();
    const { items: result } = await listResources(null, { courseCode: "TEST301", type: "exam", academicYearStart: 2024, examSession: "final" });
    expect(result.map((r) => r.title)).toEqual(["Final 2024"]);
    expect((await listResources(null, { courseCode: "TEST302", type: "exam" })).items).toEqual([]);
  });

  it("does not expose file references", async () => {
    await seed();
    const [first] = (await listResources(null)).items;
    expect(first).not.toHaveProperty("fileKey");
    expect(first).not.toHaveProperty("externalUrl");
  });

  it("reports whether a row has a link or a stored file as hasSource", async () => {
    const { a } = await seed();
    const { Resource } = getDb();
    await Resource.create({ courseId: a.id, type: "notes", title: "Stored file", fileKey: "resources/generated-key.pdf", isPublished: true });
    const bySource = new Map((await listResources(admin, { courseCode: "TEST301" })).items.map((r) => [r.title, r.hasSource]));
    expect(bySource.get("Final 2024")).toBe(true);
    expect(bySource.get("Stored file")).toBe(true);
    expect(bySource.get("Draft lecture")).toBe(false);
  });

  it("treats blank filter values as no filter, and accepts numbers as strings", async () => {
    await seed();
    const blank = { courseCode: " ", type: "", academicYearStart: "", examSession: "", language: "", page: "", pageSize: "" };
    expect((await listResources(null, blank as never)).items).toHaveLength(5);
    expect((await listResources(null, { academicYearStart: "2022" } as never)).items).toHaveLength(1);
  });

  it("filters by any year the database allows", async () => {
    const { a } = await seed();
    const { Resource } = getDb();
    await Resource.create({
      courseId: a.id, type: "exam", title: "Final 1990", academicYearStart: ACADEMIC_YEAR_MIN, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL,
    });
    const page = await listResources(null, { academicYearStart: ACADEMIC_YEAR_MIN });
    expect(page.items.map((r) => r.title)).toEqual(["Final 1990"]);
  });

  it("rejects values that are not valid filters with a ValidationError", async () => {
    await expect(listResources(null, { academicYearStart: NaN })).rejects.toBeInstanceOf(ValidationError);
    await expect(listResources(null, { academicYearStart: ACADEMIC_YEAR_MIN - 1 })).rejects.toBeInstanceOf(ValidationError);
    await expect(listResources(null, { type: "bogus" as never })).rejects.toBeInstanceOf(ValidationError);
    await expect(listResources(null, { page: 0 })).rejects.toBeInstanceOf(ValidationError);
    await expect(listResources(null, { pageSize: RESOURCE_PAGE_SIZE_MAX + 1 })).rejects.toMatchObject({
      name: "ValidationError",
      fields: ["pageSize"],
    });
  });

  it("pages the list and reports the total of visible resources", async () => {
    await seed();
    const first = await listResources(null, { pageSize: 2 });
    const second = await listResources(null, { pageSize: 2, page: 2 });
    const third = await listResources(null, { pageSize: 2, page: 3 });
    expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2 });
    expect([first.items.length, second.items.length, third.items.length]).toEqual([2, 2, 1]);
    const ids = [...first.items, ...second.items, ...third.items].map((r) => r.id);
    expect(new Set(ids).size).toBe(5);
    expect((await listResources(null, { pageSize: 2, page: 4 })).items).toEqual([]);
    expect((await listResources(admin, { pageSize: 2 })).total).toBe(6);
    expect((await listResources(null, { courseCode: "TEST302", pageSize: 2 })).total).toBe(1);
  });

  it("uses the default page size when none is given", async () => {
    await seed();
    expect(await listResources(null)).toMatchObject({ page: 1, pageSize: RESOURCE_PAGE_SIZE_DEFAULT, total: 5 });
  });
});

describe("listResources by semester", () => {
  async function seedSemesters() {
    const data = await seed();
    const { Course, Resource } = getDb();
    const s5 = await Course.create({ code: "TEST501", title: "Course E", semester: 5 });
    const s5exam = await Resource.create({
      courseId: s5.id, type: "exam", title: "S5 final 2024", academicYearStart: 2024, examSession: "final", isPublished: true, externalUrl: SAMPLE_URL,
    });
    await Resource.create({ courseId: s5.id, type: "exam", title: "S5 draft exam", academicYearStart: 2024, examSession: "final", externalUrl: SAMPLE_URL });
    return { ...data, s5, s5exam };
  }

  it("filters by the semester of the course, with a correct total", async () => {
    await seedSemesters();
    const s3 = await listResources(null, { semester: 3 });
    expect(s3.total).toBe(5);
    expect(s3.items.every((r) => r.courseCode.startsWith("TEST30"))).toBe(true);
    const s5 = await listResources(null, { semester: 5 });
    expect(s5.items.map((r) => r.title)).toEqual(["S5 final 2024"]);
    expect(s5.total).toBe(1);
    expect((await listResources(null, { semester: 4 })).total).toBe(0);
    expect((await listResources(admin, { semester: 5 })).total).toBe(2);
  });

  it("combines with the other filters and with paging", async () => {
    await seedSemesters();
    const exams = await listResources(null, { semester: 3, type: "exam" });
    expect(exams.total).toBe(3);
    expect((await listResources(null, { semester: 3, type: "exam", academicYearStart: 2024, examSession: "final" })).items.map((r) => r.title)).toEqual(["Final 2024"]);
    expect((await listResources(null, { semester: 5, courseCode: "TEST301" })).total).toBe(0);
    expect((await listResources(null, { semester: 3, courseCode: "test301", type: "exam" })).total).toBe(3);
    const paged = await listResources(null, { semester: 3, type: "exam", pageSize: 2, page: 2 });
    expect(paged).toMatchObject({ total: 3 });
    expect(paged.items).toHaveLength(1);
  });

  it("treats a blank semester as no filter and rejects one out of range", async () => {
    await seedSemesters();
    expect((await listResources(null, { semester: "" } as never)).total).toBe(6);
    expect((await listResources(null, { semester: "5" } as never)).total).toBe(1);
    await expect(listResources(null, { semester: 2 })).rejects.toMatchObject({ name: "ValidationError", fields: ["semester"] });
    await expect(listResources(null, { semester: 7 })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("listExamFilterOptions", () => {
  it("is empty when there are no exams", async () => {
    expect(await listExamFilterOptions(null)).toEqual({ semesters: [], courses: [], years: [], sessions: [] });
  });

  it("offers only values of visible exams, years newest first, courses by code", async () => {
    const { b } = await seed();
    const { Course, Resource } = getDb();
    const s5 = await Course.create({ code: "TEST501", title: "Course E", semester: 5 });
    const s4 = await Course.create({ code: "TEST401", title: "Course D", semester: 4 });
    await Resource.create({
      courseId: s5.id, type: "exam", title: "S5 second 2023", academicYearStart: 2023, examSession: "second", isPublished: true, externalUrl: SAMPLE_URL,
    });
    // Only drafts, and only non-exam resources: nothing of these may be offered to the public.
    await Resource.create({
      courseId: s4.id, type: "exam", title: "S4 draft 2025", academicYearStart: 2025, examSession: "partial", externalUrl: SAMPLE_URL,
    });
    await Resource.create({ courseId: b.id, type: "notes", title: "Notes", academicYearStart: 2019, isPublished: true, externalUrl: SAMPLE_URL });

    const expected = {
      semesters: [3, 5],
      courses: [
        { code: "TEST301", title: "Course A", semester: 3 },
        { code: "TEST501", title: "Course E", semester: 5 },
      ],
      years: [2024, 2023, 2022],
      sessions: ["partial", "final", "second"],
    };
    expect(await listExamFilterOptions(null)).toEqual(expected);
    expect(await listExamFilterOptions(student)).toEqual(expected);
  });

  it("includes values that only have drafts for an admin", async () => {
    await seed();
    const { Course, Resource } = getDb();
    const s4 = await Course.create({ code: "TEST401", title: "Course D", semester: 4 });
    await Resource.create({
      courseId: s4.id, type: "exam", title: "S4 draft 2025", academicYearStart: 2025, examSession: "partial", externalUrl: SAMPLE_URL,
    });
    const options = await listExamFilterOptions(admin);
    expect(options.semesters).toEqual([3, 4]);
    expect(options.courses.map((c) => c.code)).toEqual(["TEST301", "TEST401"]);
    expect(options.years).toEqual([2025, 2024, 2022]);
    expect((await listExamFilterOptions(null)).semesters).toEqual([3]);
  });

  it("skips an exam without an academic year when listing years", async () => {
    const { b } = await seed();
    const { Resource } = getDb();
    await Resource.create({ courseId: b.id, type: "exam", title: "Undated exam", examSession: "second", isPublished: true, externalUrl: SAMPLE_URL });
    const options = await listExamFilterOptions(null);
    expect(options.courses.map((c) => c.code)).toEqual(["TEST301", "TEST302"]);
    expect(options.years).toEqual([2024, 2022]);
    expect(options.sessions).toEqual(["partial", "final", "second"]);
  });
});

describe("getResource", () => {
  it("returns the resource with its course and linked solution", async () => {
    const { exam, solution } = await seed();
    const detail = await getResource(null, exam.id);
    expect(detail.courseCode).toBe("TEST301");
    expect(detail.courseTitle).toBe("Course A");
    expect(detail.solutions.map((s) => s.id)).toEqual([solution.id]);
    const back = await getResource(null, solution.id);
    expect(back.solutionOf?.id).toBe(exam.id);
  });

  it("does not link to an unpublished solution unless the viewer is an admin", async () => {
    const { exam } = await seed();
    const { Resource } = getDb();
    await Resource.create({ courseId: exam.courseId, type: "solution", title: "Draft solution", solutionOfId: exam.id });
    expect((await getResource(student, exam.id)).solutions).toHaveLength(1);
    expect((await getResource(admin, exam.id)).solutions).toHaveLength(2);
  });

  it("does not link a published solution to its unpublished exam unless the viewer is an admin", async () => {
    const { a } = await seed();
    const { Resource } = getDb();
    const draftExam = await Resource.create({ courseId: a.id, type: "exam", title: "Draft exam", examSession: "second" });
    const solution = await Resource.create({
      courseId: a.id, type: "solution", title: "Solution of draft", solutionOfId: draftExam.id, isPublished: true, externalUrl: SAMPLE_URL,
    });
    expect((await getResource(null, solution.id)).solutionOf).toBeNull();
    expect((await getResource(admin, solution.id)).solutionOf?.id).toBe(draftExam.id);
  });

  it("treats an unpublished resource as not found for non-admins", async () => {
    const { draft } = await seed();
    await expect(getResource(null, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResource(student, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getResource(admin, draft.id)).title).toBe("Draft lecture");
  });

  it("throws NotFoundError for a missing id and for a malformed id", async () => {
    await expect(getResource(null, "33333333-3333-4333-8333-333333333333")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResource(null, "42")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("solutions on list items", () => {
  it("lists the published solution of an exam and gives other resources an empty list", async () => {
    const { solution } = await seed();
    const items = (await listResources(null)).items;
    const final2024 = items.find((r) => r.title === "Final 2024")!;
    expect(final2024.solutions).toEqual([{ id: solution.id, type: "solution", title: "Final 2024 solution" }]);
    expect(items.filter((r) => r.id !== final2024.id).every((r) => r.solutions.length === 0)).toBe(true);
  });

  it("hides a draft solution from anonymous visitors and students, shows it to an admin", async () => {
    const { exam } = await seed();
    const { Resource } = getDb();
    await Resource.create({ courseId: exam.courseId, type: "solution", title: "Draft solution", solutionOfId: exam.id });
    const solutionsOf = async (viewer: Viewer) =>
      (await listResources(viewer)).items.find((r) => r.id === exam.id)!.solutions.map((s) => s.title);
    expect(await solutionsOf(null)).toEqual(["Final 2024 solution"]);
    expect(await solutionsOf(student)).toEqual(["Final 2024 solution"]);
    expect(await solutionsOf(admin)).toEqual(["Draft solution", "Final 2024 solution"]);
  });

  it("keeps totals and page sizes correct when a resource has several solutions", async () => {
    const { exam } = await seed();
    const { Resource } = getDb();
    await Resource.create({
      courseId: exam.courseId, type: "solution", title: "Second solution", solutionOfId: exam.id, isPublished: true, externalUrl: SAMPLE_URL,
    });
    const first = await listResources(null, { pageSize: 2 });
    const second = await listResources(null, { pageSize: 2, page: 2 });
    const third = await listResources(null, { pageSize: 2, page: 3 });
    expect(first.total).toBe(6);
    expect([first.items.length, second.items.length, third.items.length]).toEqual([2, 2, 2]);
    const ids = [...first.items, ...second.items, ...third.items].map((r) => r.id);
    expect(new Set(ids).size).toBe(6);
    const examItem = [...first.items, ...second.items, ...third.items].find((r) => r.id === exam.id)!;
    expect(examItem.solutions.map((s) => s.title)).toEqual(["Final 2024 solution", "Second solution"]);
  });
});

describe("getResourceLink", () => {
  it("returns the url of a published resource", async () => {
    const { exam } = await seed();
    expect(await getResourceLink(null, exam.id)).toEqual({ url: SAMPLE_URL });
  });

  it("treats a draft as not found for non-admins, and returns it to an admin", async () => {
    const { a } = await seed();
    const { Resource } = getDb();
    const draft = await Resource.create({ courseId: a.id, type: "lecture", title: "Draft with link", externalUrl: SAMPLE_URL });
    await expect(getResourceLink(null, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResourceLink(student, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await getResourceLink(admin, draft.id)).toEqual({ url: SAMPLE_URL });
  });

  it("throws NotFoundError for a missing id and for a malformed id", async () => {
    await expect(getResourceLink(null, "33333333-3333-4333-8333-333333333333")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResourceLink(null, "42")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns a signed read URL for a stored file, which the storage route serves with the stored bytes", async () => {
    const { a } = await seed();
    const { key } = await storeFile();
    const stored = await getDb().Resource.create({ courseId: a.id, type: "lecture", title: "Stored", fileKey: key, isPublished: true });
    const { url } = await getResourceLink(null, stored.id);
    expect(url).toContain("/api/v1/storage/local");
    const response = await serveFromStorage(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe("inline");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it("prefers the stored file when the resource has a file and a link", async () => {
    const { a } = await seed();
    const { key } = await storeFile();
    const both = await getDb().Resource.create({
      courseId: a.id, type: "lecture", title: "Both", fileKey: key, externalUrl: SAMPLE_URL, isPublished: true,
    });
    const { url } = await getResourceLink(null, both.id);
    expect(url).not.toBe(SAMPLE_URL);
    expect(url).toContain("/api/v1/storage/local");
  });

  it("keeps the visibility rules for a draft with a stored file", async () => {
    const { a } = await seed();
    const { key } = await storeFile();
    const draft = await getDb().Resource.create({ courseId: a.id, type: "lecture", title: "Draft file", fileKey: key });
    await expect(getResourceLink(null, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getResourceLink(student, draft.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await getResourceLink(admin, draft.id)).url).toContain("/api/v1/storage/local");
  });

  it("throws UnavailableError for a draft with no source, when an admin looks at it", async () => {
    const { draft } = await seed();
    await expect(getResourceLink(admin, draft.id)).rejects.toBeInstanceOf(UnavailableError);
    await expect(getResourceLink(null, draft.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("requireAdmin", () => {
  it("throws ForbiddenError for anonymous visitors and students", () => {
    expect(() => requireAdmin(null)).toThrow(ForbiddenError);
    expect(() => requireAdmin(student)).toThrow(ForbiddenError);
  });

  it("passes for an admin", () => {
    expect(() => requireAdmin(admin)).not.toThrow();
  });
});
