import path from "node:path";
import { createRequire } from "node:module";
import { Sequelize } from "sequelize";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "./models";
import { closeDb } from "./test-utils";

const require = createRequire(import.meta.url);
const migration = require(path.resolve(import.meta.dirname, "../../db/migrations/20261029100000-add-text-check-to-resources.js")) as {
  up(queryInterface: unknown, sequelize: typeof Sequelize): Promise<void>;
  down(queryInterface: unknown): Promise<void>;
};

const SCRATCH_DB = "ua_migration_scratch_text_check";

afterAll(async () => {
  await closeDb();
});

// Runs in a throwaway database with a minimal resources table.
describe("migration add-text-check-to-resources", () => {
  it("adds both columns with their rules, and down removes them so up works again", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${SCRATCH_DB}`;
    const main = getDb().sequelize;
    await main.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await main.query(`CREATE DATABASE ${SCRATCH_DB}`);

    const scratch = new Sequelize(url.toString(), { dialect: "postgres", logging: false });
    const columns = async () => {
      const [rows] = await scratch.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'resources' AND column_name IN ('page_count', 'text_page_count')");
      return rows.length;
    };
    const insert = (pages: string, text: string) => scratch.query(`INSERT INTO resources (page_count, text_page_count) VALUES (${pages}, ${text})`);
    try {
      await scratch.query("CREATE TABLE resources (id uuid PRIMARY KEY DEFAULT gen_random_uuid())");
      const queryInterface = scratch.getQueryInterface();
      await scratch.query("INSERT INTO resources DEFAULT VALUES");

      await migration.up(queryInterface, Sequelize);
      expect(await columns()).toBe(2);

      // Existing rows are "not checked". Both null, or a count between 0 and the page count.
      await insert("NULL", "NULL");
      await insert("5", "0");
      await insert("5", "5");
      await expect(insert("5", "6")).rejects.toThrow(/resources_text_check_valid_check/);
      await expect(insert("5", "NULL")).rejects.toThrow(/resources_text_check_valid_check/);
      await expect(insert("NULL", "0")).rejects.toThrow(/resources_text_check_valid_check/);
      await expect(insert("0", "0")).rejects.toThrow(/resources_text_check_valid_check/);
      await expect(insert("5", "-1")).rejects.toThrow(/resources_text_check_valid_check/);

      await migration.down(queryInterface);
      expect(await columns()).toBe(0);
      await migration.up(queryInterface, Sequelize);
      expect(await columns()).toBe(2);
    } finally {
      await scratch.close();
      await main.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    }
  });
});
