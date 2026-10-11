// Creates the test database if needed and migrates it. Never touches the development database.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

export function parseTestDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error("TEST_DATABASE_URL is not set. See .env.example.");
  }
  const url = new URL(rawUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to continue: TEST_DATABASE_URL must point to a database whose name ends with "_test" (got "${name}").`,
    );
  }
  return { url, name };
}

export async function prepareTestDb(rawUrl = process.env.TEST_DATABASE_URL) {
  const { url, name } = parseTestDatabaseUrl(rawUrl);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
  } catch (error) {
    throw new Error(
      `Cannot reach Postgres to prepare the test database. Start it with: docker compose up -d --wait (${error.message})`,
    );
  }
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (rowCount === 0) {
      // Identifier is validated above to end with _test; quote it defensively.
      await client.query(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = spawnSync(
    process.execPath,
    [path.join(root, "node_modules/sequelize-cli/lib/sequelize"), "db:migrate"],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: rawUrl, DATABASE_SSL: "false" },
      encoding: "utf8",
    },
  );
  if (result.status !== 0) {
    throw new Error(`Migrating the test database failed:\n${result.stdout}\n${result.stderr}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  prepareTestDb().then(
    () => console.log("Test database is ready."),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
