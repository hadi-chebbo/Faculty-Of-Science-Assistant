import { spawnSync } from "node:child_process";
import path from "node:path";
import { verify } from "@node-rs/argon2";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { getDb } from "./models";
import { closeDb, truncateAllTables } from "./test-utils";

const root = path.resolve(import.meta.dirname, "../..");
const cli = path.join(root, "node_modules/sequelize-cli/lib/sequelize");
const ADMIN_PASSWORD = "a-long-test-password";

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
});

afterAll(async () => {
  await closeDb();
});

describe("seeders", () => {
  it("seeds the expected rows and is idempotent", async () => {
    const first = runCli("db:seed:all", FULL_ENV);
    expect(first.status, first.output).toBe(0);

    const { sequelize } = getDb();
    const query = async (sql: string) => (await sequelize.query(sql))[0] as Record<string, unknown>[];

    expect(await count("courses")).toBe(8);
    expect(await query("SELECT 1 FROM resources r JOIN courses c ON c.id = r.course_id WHERE c.code = 'DEMO602'")).toHaveLength(0);
    const badPublished = await query(
      "SELECT 1 FROM resources WHERE is_published AND num_nonnulls(file_key, external_url) <> 1",
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
  });
});
