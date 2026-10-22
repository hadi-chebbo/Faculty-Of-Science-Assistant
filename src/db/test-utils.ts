// Helpers for database tests only. Never import this from application code.
import { getDb, type Db } from "./models";

async function assertTestDatabase(db: Db): Promise<void> {
  const [rows] = await db.sequelize.query("SELECT current_database() AS name");
  const name = (rows[0] as { name: string }).name;
  if (!name.endsWith("_test")) {
    throw new Error(`Refusing to run: connected database "${name}" does not end with "_test".`);
  }
}

export async function truncateAllTables(): Promise<void> {
  const db = getDb();
  await assertTestDatabase(db);
  await db.sequelize.query(
    "TRUNCATE TABLE email_jobs, email_confirmations, rate_limit_events, failed_sign_ins, refresh_tokens, bookmarks, completions, resources, chapters, courses, users RESTART IDENTITY CASCADE",
  );
}

export async function closeDb(): Promise<void> {
  const db = getDb();
  await db.sequelize.close();
  const g = globalThis as { __db?: Db; __sequelize?: unknown };
  delete g.__db;
  delete g.__sequelize;
}
