import path from "node:path";
import { createRequire } from "node:module";
import { Sequelize } from "sequelize";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "./models";
import { closeDb } from "./test-utils";

const require = createRequire(import.meta.url);
const migration = require(path.resolve(import.meta.dirname, "../../db/migrations/20261026100000-create-todos.js")) as {
  up(queryInterface: unknown, sequelize: typeof Sequelize): Promise<void>;
  down(queryInterface: unknown): Promise<void>;
};

const SCRATCH_DB = "ua_migration_scratch_todos";

afterAll(async () => {
  await closeDb();
});

// Runs in a throwaway database with minimal users and resources tables, so the shared test tables
// (other test files use them in parallel) are never altered.
describe("migration create-todos", () => {
  it("creates the table with its rules, and down removes it so up works again", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${SCRATCH_DB}`;
    const main = getDb().sequelize;
    await main.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await main.query(`CREATE DATABASE ${SCRATCH_DB}`);

    const scratch = new Sequelize(url.toString(), { dialect: "postgres", logging: false });
    const tableExists = async () => {
      const [rows] = await scratch.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'todos'");
      return rows.length > 0;
    };
    const insert = (columns: string, values: string) =>
      scratch.query(`INSERT INTO todos (user_id, position, ${columns}) SELECT id, 0, ${values} FROM users LIMIT 1`);
    try {
      await scratch.query("CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid())");
      await scratch.query("CREATE TABLE resources (id uuid PRIMARY KEY DEFAULT gen_random_uuid())");
      await scratch.query("INSERT INTO users DEFAULT VALUES");

      const queryInterface = scratch.getQueryInterface();
      await migration.up(queryInterface, Sequelize);
      expect(await tableExists()).toBe(true);

      // Defaults: status todo, empty title and note, timestamps set, not deleted.
      await scratch.query("INSERT INTO todos (user_id, position) SELECT id, 0 FROM users");
      const [rows] = await scratch.query("SELECT * FROM todos");
      expect(rows[0]).toMatchObject({ status: "todo", title: "", note: "", resource_id: null, deleted_at: null });
      expect((rows[0] as { status_changed_at: Date }).status_changed_at).toBeInstanceOf(Date);

      // Rules: status, position, title and note length.
      await expect(insert("status", "'later'")).rejects.toThrow(/todos_status_check/);
      await expect(scratch.query("INSERT INTO todos (user_id, position) SELECT id, -1 FROM users")).rejects.toThrow(/todos_position_check/);
      await expect(insert("title", "repeat('x', 201)")).rejects.toThrow(/todos_title_length_check|value too long/);
      await expect(insert("note", "repeat('x', 2001)")).rejects.toThrow(/todos_note_length_check/);
      await insert("title, note", "repeat('x', 200), repeat('x', 2000)");

      // Deleting the user removes the cards; deleting a resource keeps the card.
      await scratch.query("INSERT INTO resources DEFAULT VALUES");
      await scratch.query("UPDATE todos SET resource_id = (SELECT id FROM resources) WHERE title = ''");
      await scratch.query("DELETE FROM resources");
      const [kept] = await scratch.query("SELECT resource_id FROM todos WHERE title = ''");
      expect(kept).toEqual([{ resource_id: null }]);
      await scratch.query("DELETE FROM users");
      const [left] = await scratch.query("SELECT 1 FROM todos");
      expect(left).toHaveLength(0);

      await migration.down(queryInterface);
      expect(await tableExists()).toBe(false);
      await migration.up(queryInterface, Sequelize);
      expect(await tableExists()).toBe(true);
    } finally {
      await scratch.close();
      await main.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    }
  });
});
