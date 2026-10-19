import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { ModelStatic, Model } from "sequelize";
import { EXAM_SESSIONS, LANGUAGES, RESOURCE_TYPES, USER_ROLES } from "../constants";
import { closeDb, truncateAllTables } from "../test-utils";
import { getDb } from "./index";

const HASH = "$argon2id$v=19$m=19456,t=2,p=1$placeholder";
const TOKEN_HASH = "a".repeat(64);
const FAMILY_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

beforeEach(async () => {
  await truncateAllTables();
});

afterAll(async () => {
  await closeDb();
});

async function seedGraph() {
  const { Course, Resource, User, RefreshToken, Bookmark, Completion } = getDb();
  const course = await Course.create({ code: "TEST101", title: "Test Course", semester: 3 });
  const exam = await Resource.create({
    courseId: course.id,
    type: "exam",
    title: "Test exam",
    examSession: "final",
    academicYearStart: 2024,
    externalUrl: "https://example.com/exam",
    fileKey: "resources/exam.pdf",
    isPublished: true,
  });
  const solution = await Resource.create({
    courseId: course.id,
    type: "solution",
    title: "Test solution",
    solutionOfId: exam.id,
  });
  const user = await User.create({ email: "student@example.com", passwordHash: HASH });
  const token = await RefreshToken.create({
    userId: user.id,
    tokenHash: TOKEN_HASH,
    familyId: FAMILY_ID,
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  const bookmark = await Bookmark.create({ userId: user.id, resourceId: exam.id });
  const completion = await Completion.create({ userId: user.id, resourceId: exam.id });
  return { course, exam, solution, user, token, bookmark, completion };
}

describe("models: uuid ids", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  it("every table gets a uuid id and uuid foreign keys", async () => {
    const { exam, solution, user, token, bookmark, completion, course } = await seedGraph();
    for (const id of [course.id, exam.id, user.id, token.id, bookmark.id, completion.id]) {
      expect(id).toMatch(UUID);
    }
    expect(solution.solutionOfId).toBe(exam.id);
  });

  it("the database generates the id when the application does not", async () => {
    const { sequelize } = getDb();
    const [rows] = await sequelize.query(
      "INSERT INTO courses (code, title, semester) VALUES ('TEST900', 'Default id', 3) RETURNING id",
    );
    expect((rows[0] as { id: string }).id).toMatch(UUID);
  });
});

describe("models: create and read back", () => {
  it("Course", async () => {
    const { Course } = getDb();
    const created = await Course.create({ code: "TEST101", title: "Test Course", semester: 4 });
    const found = await Course.findByPk(created.id);
    expect(found?.code).toBe("TEST101");
    expect(found?.title).toBe("Test Course");
    expect(found?.semester).toBe(4);
    expect(found?.createdAt).toBeInstanceOf(Date);
    expect(found?.updatedAt).toBeInstanceOf(Date);
  });

  it("Resource", async () => {
    const { Course, Resource } = getDb();
    const course = await Course.create({ code: "TEST101", title: "Test Course", semester: 3 });
    const created = await Resource.create({
      courseId: course.id,
      type: "exam",
      title: "Test exam",
      description: "Test description",
      academicYearStart: 2023,
      examSession: "partial",
      language: "fr",
      externalUrl: "https://example.com/x",
      fileKey: "resources/x.pdf",
      isPublished: true,
    });
    const found = await Resource.findByPk(created.id);
    expect(found?.courseId).toBe(course.id);
    expect(found?.type).toBe("exam");
    expect(found?.description).toBe("Test description");
    expect(found?.academicYearStart).toBe(2023);
    expect(found?.examSession).toBe("partial");
    expect(found?.language).toBe("fr");
    expect(found?.fileKey).toBe("resources/x.pdf");
    expect(found?.externalUrl).toBe("https://example.com/x");
    expect(found?.solutionOfId).toBeNull();
    expect(found?.isPublished).toBe(true);
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("Resource cannot be published without a file, whatever its link", async () => {
    const { Course, Resource } = getDb();
    const course = await Course.create({ code: "TEST101", title: "Test Course", semester: 3 });
    const draft = { courseId: course.id, type: "lecture" as const, title: "Link only", externalUrl: "https://example.com/x" };
    await expect(Resource.create({ ...draft, isPublished: true })).rejects.toThrow(/resources_published_has_file_check/);
    await Resource.create({ ...draft, isPublished: false });
    await Resource.create({ ...draft, fileKey: "resources/x.pdf", isPublished: true });
  });

  it("Resource defaults to English and unpublished", async () => {
    const { Course, Resource } = getDb();
    const course = await Course.create({ code: "TEST101", title: "Test Course", semester: 3 });
    const created = await Resource.create({ courseId: course.id, type: "lecture", title: "Draft" });
    const found = await Resource.findByPk(created.id);
    expect(found?.language).toBe("en");
    expect(found?.isPublished).toBe(false);
  });

  it("User", async () => {
    const { User } = getDb();
    const created = await User.create({ email: "a@example.com", name: "A", passwordHash: HASH });
    const found = await User.findByPk(created.id);
    expect(found?.email).toBe("a@example.com");
    expect(found?.name).toBe("A");
    expect(found?.role).toBe("student");
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("RefreshToken", async () => {
    const { User, RefreshToken } = getDb();
    const user = await User.create({ email: "a@example.com", passwordHash: HASH });
    const expiresAt = new Date(Date.now() + 3_600_000);
    const created = await RefreshToken.create({
      userId: user.id,
      tokenHash: TOKEN_HASH,
      familyId: FAMILY_ID,
      expiresAt,
    });
    const found = await RefreshToken.findByPk(created.id);
    expect(found?.userId).toBe(user.id);
    expect(found?.tokenHash).toBe(TOKEN_HASH);
    expect(found?.familyId).toBe(FAMILY_ID);
    expect(found?.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(found?.revokedAt).toBeNull();
    expect(found?.createdAt).toBeInstanceOf(Date);
  });

  it("Bookmark and Completion", async () => {
    const { bookmark, completion, user, exam } = await seedGraph();
    const { Bookmark, Completion } = getDb();
    const b = await Bookmark.findByPk(bookmark.id);
    const c = await Completion.findByPk(completion.id);
    for (const row of [b, c]) {
      expect(row?.userId).toBe(user.id);
      expect(row?.resourceId).toBe(exam.id);
      expect(row?.createdAt).toBeInstanceOf(Date);
    }
  });
});

describe("associations", () => {
  it("loads every alias through include", async () => {
    const { Course, Resource, User, RefreshToken, Bookmark, Completion } = getDb();
    const { course, exam, solution, user, token, bookmark, completion } = await seedGraph();

    const c = await Course.findByPk(course.id, { include: ["resources"] });
    expect(c?.resources).toHaveLength(2);

    const r = await Resource.findByPk(exam.id, {
      include: ["course", "solutions", "bookmarks", "completions"],
    });
    expect(r?.course?.id).toBe(course.id);
    expect(r?.solutions?.map((s) => s.id)).toEqual([solution.id]);
    expect(r?.bookmarks?.map((b) => b.id)).toEqual([bookmark.id]);
    expect(r?.completions?.map((x) => x.id)).toEqual([completion.id]);

    const s = await Resource.findByPk(solution.id, { include: ["solutionOf"] });
    expect(s?.solutionOf?.id).toBe(exam.id);

    const u = await User.findByPk(user.id, {
      include: ["refreshTokens", "bookmarks", "completions"],
    });
    expect(u?.refreshTokens?.map((x) => x.id)).toEqual([token.id]);
    expect(u?.bookmarks?.map((x) => x.id)).toEqual([bookmark.id]);
    expect(u?.completions?.map((x) => x.id)).toEqual([completion.id]);

    const t = await RefreshToken.findByPk(token.id, { include: ["user"] });
    expect(t?.user?.id).toBe(user.id);

    for (const Model of [Bookmark, Completion]) {
      const row = await Model.findOne({ include: ["user", "resource"] });
      expect(row?.user?.id).toBe(user.id);
      expect(row?.resource?.id).toBe(exam.id);
    }
  });
});

describe("User", () => {
  it("excludes passwordHash by default and includes it with the withPasswordHash scope", async () => {
    const { User } = getDb();
    await User.create({ email: "a@example.com", passwordHash: HASH });

    const plain = await User.findOne();
    expect(plain?.passwordHash).toBeUndefined();
    expect(plain?.toJSON()).not.toHaveProperty("passwordHash");

    const scoped = await User.scope("withPasswordHash").findOne();
    expect(scoped?.passwordHash).toBe(HASH);
  });

  it("stores the email trimmed and lowercased", async () => {
    const { User } = getDb();
    const user = await User.create({ email: "  Demo@Example.COM ", passwordHash: HASH });
    expect(user.email).toBe("demo@example.com");
    const found = await User.findByPk(user.id);
    expect(found?.email).toBe("demo@example.com");
  });
});

describe("timestamps", () => {
  it("updating a course changes updatedAt", async () => {
    const { Course } = getDb();
    const course = await Course.create({ code: "TEST101", title: "Before", semester: 3 });
    const before = course.updatedAt.getTime();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await course.update({ title: "After" });
    const found = await Course.findByPk(course.id);
    expect(found?.title).toBe("After");
    expect(found!.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe("schema agreement", () => {
  async function constraintValues(name: string): Promise<string[]> {
    const { sequelize } = getDb();
    const [rows] = await sequelize.query(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = :name",
      { replacements: { name } },
    );
    expect(rows).toHaveLength(1);
    const def = (rows[0] as { def: string }).def;
    return [...def.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }

  it.each([
    ["resources_type_check", RESOURCE_TYPES],
    ["resources_exam_session_check", EXAM_SESSIONS],
    ["resources_language_check", LANGUAGES],
    ["users_role_check", USER_ROLES],
  ])("constants match %s", async (name, constant) => {
    expect(new Set(await constraintValues(name))).toEqual(new Set(constant));
  });

  it("each model has exactly the columns of its table", async () => {
    const db = getDb();
    const models: ModelStatic<Model>[] = [
      db.Course,
      db.Resource,
      db.User,
      db.RefreshToken,
      db.Bookmark,
      db.Completion,
    ];
    expect(models).toHaveLength(6);
    for (const model of models) {
      const table = model.getTableName() as string;
      const [rows] = await db.sequelize.query(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table",
        { replacements: { table } },
      );
      const dbColumns = new Set((rows as { column_name: string }[]).map((r) => r.column_name));
      const modelColumns = new Set(Object.values(model.getAttributes()).map((a) => a.field));
      expect(dbColumns.size, `table ${table} exists`).toBeGreaterThan(0);
      expect(modelColumns, `columns of ${table}`).toEqual(dbColumns);
    }
  });
});

describe("chapters", () => {
  async function courseWithChapter() {
    const { Course, Chapter } = getDb();
    const course = await Course.create({ code: "TEST101", title: "Test Course", semester: 3 });
    const chapter = await Chapter.create({ courseId: course.id, position: 1, title: "Test chapter" });
    return { course, chapter };
  }

  it("a chapter can be created and read back", async () => {
    const { Chapter } = getDb();
    const { course, chapter } = await courseWithChapter();
    const found = await Chapter.findByPk(chapter.id, { include: "course" });
    expect(found?.title).toBe("Test chapter");
    expect(found?.position).toBe(1);
    expect(found?.course?.id).toBe(course.id);
  });

  it("rejects a duplicate position within a course but allows it in another course", async () => {
    const { Course, Chapter } = getDb();
    const { course } = await courseWithChapter();
    await expect(Chapter.create({ courseId: course.id, position: 1, title: "Again" })).rejects.toThrow();
    const other = await Course.create({ code: "TEST102", title: "Other", semester: 3 });
    await expect(Chapter.create({ courseId: other.id, position: 1, title: "Fine" })).resolves.toBeDefined();
  });

  it("rejects a blank title and a position outside the range", async () => {
    const { Chapter } = getDb();
    const { course } = await courseWithChapter();
    await expect(Chapter.create({ courseId: course.id, position: 2, title: "   " })).rejects.toThrow();
    await expect(Chapter.create({ courseId: course.id, position: 0, title: "Zero" })).rejects.toThrow();
    await expect(Chapter.create({ courseId: course.id, position: 201, title: "Too high" })).rejects.toThrow();
  });

  it("a resource can reference a chapter", async () => {
    const { Resource } = getDb();
    const { course, chapter } = await courseWithChapter();
    const lecture = await Resource.create({
      courseId: course.id,
      type: "lecture",
      title: "Test lecture",
      chapterId: chapter.id,
    });
    const found = await Resource.findByPk(lecture.id, { include: "chapter" });
    expect(found?.chapterId).toBe(chapter.id);
    expect(found?.chapter?.title).toBe("Test chapter");
  });

  it("the database rejects an exam with a chapter", async () => {
    const { Resource } = getDb();
    const { course, chapter } = await courseWithChapter();
    await expect(
      Resource.create({
        courseId: course.id,
        type: "exam",
        title: "Test exam",
        examSession: "final",
        academicYearStart: 2024,
        chapterId: chapter.id,
      }),
    ).rejects.toThrow();
  });

  it("deleting a chapter keeps its resources and clears their chapterId", async () => {
    const { Resource, Chapter } = getDb();
    const { course, chapter } = await courseWithChapter();
    const lecture = await Resource.create({
      courseId: course.id,
      type: "lecture",
      title: "Test lecture",
      chapterId: chapter.id,
    });
    await Chapter.destroy({ where: { courseId: course.id } });
    const found = await Resource.findByPk(lecture.id);
    expect(found).not.toBeNull();
    expect(found?.chapterId).toBeNull();
  });

  it("the chapters model has exactly the columns of its table", async () => {
    const { sequelize, Chapter } = getDb();
    const [rows] = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'chapters'",
    );
    const dbColumns = new Set((rows as { column_name: string }[]).map((r) => r.column_name));
    const modelColumns = new Set(Object.values(Chapter.getAttributes()).map((a) => a.field));
    expect(modelColumns).toEqual(dbColumns);
  });
});
