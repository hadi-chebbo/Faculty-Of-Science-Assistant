# UniversityAssistant

> DRAFT — written during planning, before any code exists. Sections marked
> (proposed) are not yet confirmed by the owner. Update this file when a
> decision changes; do not let it drift from the code.

## Product

A study platform for Computer Science students of the Faculty of Science,
Lebanese University (Hadath branch). It replaces scattered Google Drive links with one organized,
fast, mobile-friendly place to find course material and previous exams.

- The product is a study platform, not an AI chatbot. Every core feature must
  work when AI is unavailable.
- Scope is one major in one faculty and branch. Do not add Major, Faculty,
  University or Branch entities or abstractions. Other majors may come later;
  add the entity then, by migration.
- Semesters covered: S3–S6. S1–S2 are out of scope. Launch content is S3 and
  S5 (the autumn semesters); S4 and S6 follow in spring.
- Built and operated by one developer, who is also the only admin and the only
  person who uploads content.
- Target: usable MVP live before partial exams (around early December 2026).

## MVP scope

In:
- Browse semesters → courses → resources, grouped by resource type.
- Previous exams filterable by course, academic year and session.
- Search over course codes, titles and resource metadata.
- Open PDFs in the browser and download them.
- Admin-only upload and tagging of resources.

After launch, in this order:
- Student accounts, bookmarks, explicit "mark as done".
- Per-course AI Q&A grounded in uploaded material, with source citations.

Out until explicitly agreed: student uploads, interactive exercises, scoring,
mock exam generation, personalization.

## Product rules

- Browsing and downloading never require an account.
- Progress is never inferred from opening a file. "Opened", "marked done" and
  "assessed" are separate signals and are never merged into one percentage.
- AI-generated content is always visibly labelled and never presented as
  official university material.
- University material is not published publicly until the faculty has
  approved its use. Until then, use seed/sample data.
- Seed data is placeholder during development: obviously fake course codes,
  titles and resources. The real course list and files are loaded in a
  separate data-gathering phase; do not ask for them or invent real-looking
  ones before then.
- When a requirement is ambiguous, ask; do not invent product behaviour.

## Domain model (proposed)

- All ids are UUIDs (`gen_random_uuid()` default in the database); foreign keys are
  UUIDs and services treat every id as a string.
- Course: unique course code, title, semester (3–6).
- Resource: belongs to one course. Type (lecture, notes, exercise, exam,
  solution, other), title, description, academic year, exam session
  (partial, final, second — exams only), language (en, fr), file reference,
  optional link to the resource it is a solution of, published flag.
- User: email (stored lowercase), optional name, password hash, role
  (student or admin).
- RefreshToken: belongs to a user; token hash, family id, expiry, revoked-at.
- Bookmark and Completion: each one row per (user, resource). A completion
  means the student explicitly marked the resource done; un-marking deletes it.

## Stack (proposed)

- One Next.js application (App Router, TypeScript strict). No separate backend
  service.
- PostgreSQL with Sequelize 6 (owner's choice over Drizzle) and committed
  sequelize-cli migrations in `db/migrations` (CommonJS, each with a working
  `down`). Postgres full-text search; no separate search service.
- Package manager: npm. Node 22+. `@types/node` is kept at 24.
- S3-compatible object storage for files, delivered through short-lived
  signed URLs.
- Tailwind CSS with shadcn/ui (confirmed). Build UI from shadcn/ui components;
  add each one through its CLI as it is needed, and do not hand-roll a
  component that shadcn/ui already provides or add another component library.
- Zod for validating all external input.
- Vitest for unit/integration tests, Playwright for the core user journeys.
- Hosting: Vercel (app), Neon (Postgres), Cloudflare R2 (files).
- Auth (owner's decision): email and password, with short-lived stateless
  access tokens and long-lived refresh tokens. Refresh tokens are stored only
  as SHA-256 hashes in `refresh_tokens`, rotated on every use, and grouped by
  `family_id` so a reused token revokes its whole chain. Our own tables and
  code; no auth framework.
- The single admin account is created by a seed script; there is no public
  sign-up for admins.
- Migration style: one table per file; Sequelize API (`createTable`,
  `addConstraint`, `addIndex`), not raw SQL; `Sequelize.literal` only for
  checks that need a function or compare columns; `up` in a transaction;
  timestamps default with `Sequelize.fn('now')`, never `Sequelize.NOW`.
- Error tracking: not yet decided.

## Engineering rules

- Work in small vertical slices that leave the app working and deployable.
- No new dependency without a stated reason.
- Every schema change is a migration; never edit the database by hand.
- Authorization is checked on the server for every admin action.
- Uploads are validated for type and size on the server; files are stored
  under generated keys, never under user-supplied names.
- Secrets live in environment variables and are never committed. Keep
  `.env.example` current.
- UI is designed mobile-first and must stay usable on a slow connection.
- Never weaken or delete a test to make it pass.
- Never report tests or checks as passing unless they were actually run.

## Workflow

Before a significant change: state the goal, dependencies, expected changes
and risks. After: run the relevant checks, then report what changed, which
checks ran with their results, and what limitations remain. Do not touch
unrelated code.
