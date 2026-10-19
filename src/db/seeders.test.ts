import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { verify } from "@node-rs/argon2";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./models";
import { closeDb, truncateAllTables } from "./test-utils";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "node_modules/sequelize-cli/lib/sequelize");
const FULL_CODES = ["DEMO310", "DEMO410", "DEMO510", "DEMO610"];
const ADMIN_PASSWORD = "a-long-test-password";
// The seeder stores demo files through the storage driver; tests use a throwaway local folder.
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "ua-seed-storage-"));

function storedPdfs(): string[] {
  const dir = path.join(storageDir, "resources");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith(".pdf")) : [];
}

// A controlled child environment: nothing from .env or the parent leaks in.
function runCli(command: string, extra: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [cli, command], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: process.env.PATH ?? "",
      NODE_ENV: "test",
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      DATABASE_SSL: "false",
      STORAGE_DRIVER: "local",
      STORAGE_LOCAL_DIR: storageDir,
      ...extra,
    },
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

async function count(table: string): Promise<number> {
  const [rows] = await getDb().sequelize.query(`SELECT count(*)::int AS n FROM ${table}`);
  return (rows[0] as { n: number }).n;
}

async function counts() {
  return {
    courses: await count("courses"),
    resources: await count("resources"),
    users: await count("users"),
    bookmarks: await count("bookmarks"),
    completions: await count("completions"),
    refreshTokens: await count("refresh_tokens"),
  };
}

const FULL_ENV = {
  SEED_DEMO_DATA: "true",
  ADMIN_EMAIL: "  Admin@Example.COM ",
  ADMIN_PASSWORD,
};

beforeEach(async () => {
  await truncateAllTables();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

afterAll(async () => {
  await closeDb();
  fs.rmSync(storageDir, { recursive: true, force: true });
});

describe("seeders", () => {
  it("seeds the expected rows and is idempotent", async () => {
    const first = runCli("db:seed:all", FULL_ENV);
    expect(first.status, first.output).toBe(0);

    const { sequelize } = getDb();
    const query = async (sql: string) => (await sequelize.query(sql))[0] as Record<string, unknown>[];

    expect(await count("courses")).toBe(12);
    expect(await query("SELECT 1 FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = 'DEMO602'")).toHaveLength(0);
    // Every published demo resource has a stored file and keeps its (fake) backup link.
    const badPublished = await query(
      "SELECT 1 FROM resources WHERE is_published AND num_nonnulls(file_key, external_url) <> 2",
    );
    expect(badPublished).toHaveLength(0);

    const student = await query("SELECT id, role FROM users WHERE email = 'demo.student@example.com'");
    expect(student).toHaveLength(1);
    expect(student[0].role).toBe("student");
    expect(await count("bookmarks")).toBe(3);
    expect(await count("completions")).toBe(2);

    const admin = await query("SELECT role, password_hash FROM users WHERE email = 'admin@example.com'");
    expect(admin).toHaveLength(1);
    expect(admin[0].role).toBe("admin");
    expect(await verify(admin[0].password_hash as string, ADMIN_PASSWORD)).toBe(true);
    expect(first.output).not.toContain(ADMIN_PASSWORD);

    const afterFirst = await counts();
    expect(afterFirst.users).toBe(2);

    const second = runCli("db:seed:all", FULL_ENV);
    expect(second.status, second.output).toBe(0);
    expect(await counts()).toEqual(afterFirst);
  });

  it("stores one placeholder PDF per sourced resource, and replaces them when seeded again", async () => {
    expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
    const query = async (sql: string) => (await getDb().sequelize.query(sql))[0] as Record<string, unknown>[];
    const keys = (await query("SELECT file_key FROM resources WHERE file_key IS NOT NULL")).map((r) => r.file_key as string);
    expect(keys.length).toBeGreaterThan(100);
    expect(new Set(keys).size).toBe(keys.length);
    // Only the deliberate no-source drafts have no file.
    expect(await query("SELECT 1 FROM resources WHERE file_key IS NULL AND external_url IS NOT NULL")).toHaveLength(0);
    expect(storedPdfs()).toHaveLength(keys.length);
    const first = fs.readFileSync(path.join(storageDir, keys[0]));
    expect(first.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(first.toString("latin1")).toContain("(SAMPLE FILE) Tj");

    // A second run swaps in new files and leaves no orphans.
    expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
    const again = (await query("SELECT file_key FROM resources WHERE file_key IS NOT NULL")).map((r) => r.file_key as string);
    expect(again).toHaveLength(keys.length);
    expect(storedPdfs()).toHaveLength(keys.length);
  });

  describe("demo chapters", () => {
    async function chapterState() {
      const { sequelize } = getDb();
      const [chapters] = await sequelize.query(
        `SELECT c.code, ch.position, ch.title,
                (SELECT count(*)::int FROM resources r WHERE r.chapter_id = ch.id) AS attached
         FROM chapters ch JOIN courses c ON c.id = ch.course_id
         ORDER BY c.code, ch.position`,
      );
      const [unattached] = await sequelize.query(
        `SELECT c.code, count(*)::int AS n FROM resources r JOIN courses c ON c.id = r.course_id
         WHERE c.code LIKE 'DEMO%' AND r.type <> 'exam' AND r.chapter_id IS NULL
         GROUP BY c.code ORDER BY c.code`,
      );
      return { chapters, unattached };
    }

    it("creates chapters with attached and unattached resources, without duplicates on a second run", async () => {
      expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
      const first = await chapterState();
      const chapters = first.chapters as { code: string; title: string; attached: number }[];
      expect(chapters).toHaveLength(9 + 4 * 6);
      expect(new Set(chapters.map((c) => c.code))).toEqual(
        new Set(["DEMO301", "DEMO302", "DEMO501", ...FULL_CODES]),
      );
      expect(chapters.some((c) => c.title === "Sample chapter 1")).toBe(true);
      expect(chapters.some((c) => c.attached > 0)).toBe(true);
      // Exercises belong to chapters too, not only lectures and notes.
      const [exercises] = await getDb().sequelize.query(
        "SELECT count(*)::int AS n FROM resources WHERE type = 'exercise' AND chapter_id IS NOT NULL",
      );
      expect((exercises[0] as { n: number }).n).toBeGreaterThan(0);
      const unattached = first.unattached as { code: string }[];
      for (const code of ["DEMO301", "DEMO302", "DEMO501"]) {
        expect(
          unattached.some((u) => u.code === code),
          code,
        ).toBe(true);
      }

      expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
      expect(await chapterState()).toEqual(first);
    });

    it("adds the chapters to demo data that was seeded before chapters existed", async () => {
      expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
      const expected = await chapterState();
      const { sequelize } = getDb();
      // The foreign key clears the resources' chapter when the chapters go.
      await sequelize.query("DELETE FROM chapters");
      expect((await chapterState()).chapters).toHaveLength(0);

      const again = runCli("db:seed:all", FULL_ENV);
      expect(again.status, again.output).toBe(0);
      expect(await chapterState()).toEqual(expected);
      expect(await count("courses")).toBe(12);
    });
  });

  describe("full demo courses", () => {
    const codes = FULL_CODES.map((c) => `'${c}'`).join(",");
    const query = async (sql: string) => (await getDb().sequelize.query(sql))[0] as Record<string, unknown>[];

    beforeEach(() => {
      expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
    });

    it("has six chapters per course with exactly one empty", async () => {
      const rows = await query(
        `SELECT c.code, count(*)::int AS chapters,
                count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM resources r WHERE r.chapter_id = ch.id))::int AS empty
         FROM chapters ch JOIN courses c ON c.id = ch.course_id WHERE c.code IN (${codes}) GROUP BY c.code`,
      );
      expect(rows).toHaveLength(4);
      for (const row of rows) expect([row.chapters, row.empty], String(row.code)).toEqual([6, 1]);
    });

    it("puts lectures, notes, exercises and solutions in chapters, and never exams", async () => {
      for (const code of FULL_CODES) {
        const types = await query(
          `SELECT DISTINCT r.type FROM resources r JOIN courses c ON c.id = r.course_id
           WHERE c.code = '${code}' AND r.chapter_id IS NOT NULL`,
        );
        expect(types.map((t) => t.type).sort(), code).toEqual(["exercise", "lecture", "notes", "solution"]);
      }
      expect(
        await query("SELECT 1 FROM resources WHERE type = 'exam' AND chapter_id IS NOT NULL"),
      ).toHaveLength(0);
    });

    it("covers several years and all sessions with exams, per course", async () => {
      for (const code of FULL_CODES) {
        const rows = await query(
          `SELECT count(DISTINCT academic_year_start)::int AS years, count(DISTINCT exam_session)::int AS sessions
           FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = '${code}' AND r.type = 'exam'`,
        );
        expect(rows[0].years as number, code).toBeGreaterThanOrEqual(3);
        expect(rows[0].sessions, code).toBe(3);
      }
    });

    it("has a draft, an unlinked solution, a draft without source and material outside chapters", async () => {
      for (const code of FULL_CODES) {
        const [row] = await query(
          `SELECT
             count(*) FILTER (WHERE NOT is_published AND chapter_id IS NOT NULL AND external_url IS NOT NULL)::int AS draft,
             count(*) FILTER (WHERE NOT is_published AND num_nonnulls(file_key, external_url) = 0)::int AS bare,
             count(*) FILTER (WHERE type = 'solution' AND solution_of_id IS NULL)::int AS loose,
             count(*) FILTER (WHERE chapter_id IS NULL AND type IN ('other', 'notes'))::int AS general
           FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = '${code}'`,
        );
        expect(row.draft, code).toBe(1);
        expect(row.bare, code).toBe(1);
        expect(row.loose, code).toBe(1);
        expect(row.general as number, code).toBeGreaterThanOrEqual(3);
      }
    });

    it("keeps every chapter link inside its own course and every published resource sourced by a file and a link", async () => {
      expect(
        await query(
          "SELECT 1 FROM resources r JOIN chapters ch ON ch.id = r.chapter_id WHERE ch.course_id <> r.course_id",
        ),
      ).toHaveLength(0);
      expect(
        await query("SELECT 1 FROM resources WHERE is_published AND num_nonnulls(file_key, external_url) <> 2"),
      ).toHaveLength(0);
    });

    it("gives the same counts when seeded twice", async () => {
      const before = { ...(await counts()), chapters: await count("chapters") };
      expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
      expect({ ...(await counts()), chapters: await count("chapters") }).toEqual(before);
    });
  });

  it("inserts nothing without the flags", () => {
    const run = runCli("db:seed:all");
    expect(run.status, run.output).toBe(0);
    return counts().then((c) => {
      expect(Object.values(c).every((n) => n === 0)).toBe(true);
    });
  });

  it("fails and inserts nothing when the admin password is too short", async () => {
    const run = runCli("db:seed:all", { ADMIN_EMAIL: "admin@example.com", ADMIN_PASSWORD: "short" });
    expect(run.status).not.toBe(0);
    expect(run.output).toContain("at least 12 characters");
    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
  });

  it("db:seed:undo:all leaves every table empty", async () => {
    expect(runCli("db:seed:all", FULL_ENV).status).toBe(0);
    expect((await counts()).users).toBe(2);

    const undo = runCli("db:seed:undo:all", FULL_ENV);
    expect(undo.status, undo.output).toBe(0);
    expect(Object.values(await counts()).every((n) => n === 0)).toBe(true);
    expect(storedPdfs()).toHaveLength(0);
  });
});
