# University Assistant

Study platform for Computer Science students of the Faculty of Science, Lebanese University (Hadath).
See `CLAUDE.md` for product context, scope and engineering rules.

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

## Configuration

All configuration comes from environment variables, validated at startup in `src/lib/env.ts`.
See `.env.example`. Never commit `.env`.
