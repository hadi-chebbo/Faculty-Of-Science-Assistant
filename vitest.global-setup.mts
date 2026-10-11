import { prepareTestDb } from "./scripts/prepare-test-db.mjs";

const DEFAULT_TEST_URL = "postgres://app:app@localhost:5432/university_assistant_test";

export default async function setup() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: fall back to the defaults below or to the real environment.
  }
  const testUrl = process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_URL;
  try {
    await prepareTestDb(testUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not prepare the test database. Is Postgres running? Start it with: docker compose up -d --wait\n${message}`,
    );
  }
  // Tests (and the app code they import) connect to the test database only.
  process.env.DATABASE_URL = testUrl;
  process.env.DATABASE_SSL = "false";
}
