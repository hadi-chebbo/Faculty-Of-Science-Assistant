# University Assistant

Study platform for Computer Science students of the Faculty of Science, Lebanese University (Hadath).
See `CLAUDE.md` for product context, scope and engineering rules.
See `docs/dependencies.md` for what each dependency is and why the project has it.

## Requirements

- Node.js 22 or newer
- Docker (for local Postgres)

## Run locally

```bash
cp .env.example .env
docker compose up -d --wait   # Postgres on localhost:5432
npm install
npm run db:migrate
npm run dev                   # http://localhost:3000
```

Check it works: open http://localhost:3000 and http://localhost:3000/api/health
(expects `{"status":"ok","database":"up"}`).

## Checks

```bash
npm run lint
npm run typecheck
npm test            # unit tests (Vitest)
npm run test:e2e    # browser smoke tests (Playwright); needs the database running
```

First time only: `npx playwright install chromium`.

## Database migrations (Sequelize)

```bash
npm run db:migration:create -- add-courses   # new file in db/migrations
npm run db:migrate
npm run db:migrate:undo                      # reverts the last migration
npm run db:migrate:status
```

Every schema change is a migration. Migrations are plain CommonJS files in `db/migrations`,
and each must implement a working `down`. Set `DATABASE_SSL=true` for hosted databases such as Neon.

### Running migrations against Neon

Create a separate, gitignored file `.env.neon` next to `.env`, once, with two lines:

```
DATABASE_URL=<Neon direct connection string, not the "-pooler" one>
DATABASE_SSL=true
```

Then look first, and migrate:

```bash
npm run db:migrate:status:neon
npm run db:migrate:neon
```

These scripts read only `.env.neon`, never `.env`, and fail immediately if the file is missing.

- Do not name the file `.env.production` or `.env.local`: Next.js loads those automatically.
- Never `export DATABASE_URL` in your terminal. A variable already set in the shell takes
  precedence over any env file, so both the local and the Neon scripts would use it.
- There is deliberately no Neon undo or seed script. Rolling back or seeding production
  must stay a deliberate manual command.

## Seeding

```bash
npm run db:seed        # runs all seeders; safe to run repeatedly
npm run db:seed:undo   # removes what the seeders created
```

- `SEED_DEMO_DATA=true` (in `.env`) enables the fake demo courses, resources and demo student
  (`demo.student@example.com`). Local development only; never set it in production.
- Seeding also writes one placeholder PDF per demo resource through the storage driver: into
  `.storage` locally, or into the R2 bucket when `STORAGE_DRIVER=r2`. `npm run db:seed:undo`
  deletes them again. Needs Node 22.18+. Set `STORAGE_DRIVER=local` to keep seeding off R2.
- The admin account is created by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters)
  when running `npm run db:seed`. Running it again with the same email updates the password.

## Tests and the database

`npm test` needs Docker Postgres running (`docker compose up -d --wait`). It uses a separate
database (`TEST_DATABASE_URL`, name must end in `_test`), created and migrated automatically,
so development data is never touched.

## Configuration

All configuration comes from environment variables, validated at startup in `src/lib/env.ts`.
See `.env.example`. Never commit `.env`.
