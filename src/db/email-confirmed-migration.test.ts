import path from "node:path";
import { createRequire } from "node:module";
import { Sequelize } from "sequelize";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "./models";
import { closeDb } from "./test-utils";

const require = createRequire(import.meta.url);
const migration = require(path.resolve(import.meta.dirname, "../../db/migrations/20261022100000-add-email-confirmed-at-to-users.js")) as {
  up(queryInterface: unknown, sequelize: typeof Sequelize): Promise<void>;
  down(queryInterface: unknown): Promise<void>;
};

const SCRATCH_DB = "ua_migration_scratch_email_confirmed";

afterAll(async () => {
  await closeDb();
});

// Runs in a throwaway database with a minimal users table, so the shared test tables (other test
// files use them in parallel) are never altered.
describe("migration add-email-confirmed-at-to-users", () => {
  it("backfills existing users as confirmed at their creation time, and down removes the column", async () => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${SCRATCH_DB}`;
    const main = getDb().sequelize;
    await main.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    await main.query(`CREATE DATABASE ${SCRATCH_DB}`);

    const scratch = new Sequelize(url.toString(), { dialect: "postgres", logging: false });
    try {
      await scratch.query(
        "CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL, created_at timestamptz NOT NULL)",
      );
      await scratch.query("INSERT INTO users (email, created_at) VALUES ('old@example.com', '2026-01-02T03:04:05Z')");

      const queryInterface = scratch.getQueryInterface();
      await migration.up(queryInterface, Sequelize);
      const [rows] = await scratch.query("SELECT email_confirmed_at, created_at FROM users");
      const row = rows[0] as { email_confirmed_at: Date; created_at: Date };
      expect(row.email_confirmed_at).toEqual(row.created_at);

      // A user added afterwards starts unconfirmed.
      await scratch.query("INSERT INTO users (email, created_at) VALUES ('new@example.com', now())");
      const [fresh] = await scratch.query("SELECT email_confirmed_at FROM users WHERE email = 'new@example.com'");
      expect((fresh[0] as { email_confirmed_at: Date | null }).email_confirmed_at).toBeNull();

      await migration.down(queryInterface);
      const [columns] = await scratch.query(
        "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_confirmed_at'",
      );
      expect(columns).toHaveLength(0);
    } finally {
      await scratch.close();
      await main.query(`DROP DATABASE IF EXISTS ${SCRATCH_DB}`);
    }
  });
});
