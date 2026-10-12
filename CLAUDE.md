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
- Files are meant to be read inside the platform, on a page of our own, not by
  sending the student away to the file's link: the AI assistant planned for
  after launch should be able to help while they read. The current open route,
  which redirects to the material, is a stopgap. Design file storage and the
  open flow so a file can be shown inside our own page. When the reader page is
  built is not yet decided.
- When a requirement is ambiguous, ask; do not invent product behaviour.

## Domain model (proposed)

- All ids are UUIDs (`gen_random_uuid()` default in the database); foreign keys are
  UUIDs and services treat every id as a string.
- Course: unique course code, title, semester (3–6).
- Resource: belongs to one course. Type (lecture, notes, exercise, exam,
  solution, other), title, description, academic year, exam session
  (partial, final, second — exams only), language (en, fr), file reference,
  optional link to the resource it is a solution of, optional chapter of the
  same course (never on exams; a resource with no chapter is listed under
  General), published flag.
- Chapter: belongs to one course; position unique within the course; title.
- User: email (stored lowercase), optional name, password hash, role
  (student or admin).
- RefreshToken: belongs to a user; token hash, family id, expiry, revoked-at.
- FailedSignIn (`failed_sign_ins`): normalised email, IP, time. Only failures are
  stored; no link to users, so unknown emails are counted too. Old rows are pruned.
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
- `next-themes` for the light/dark theme toggle (no flash of the wrong theme on load).
- Zod for validating all external input.
- Vitest for unit/integration tests, Playwright for the core user journeys.
- Hosting: Vercel (app), Neon (Postgres), Cloudflare R2 (files).
- Auth (owner's decision): email and password, with short-lived stateless
  access tokens and long-lived refresh tokens. Refresh tokens are stored only
  as SHA-256 hashes in `refresh_tokens`, rotated on every use, and grouped by
  `family_id` so a reused token revokes its whole chain. Our own tables and
  code; no auth framework.
- Access tokens are HS256 JWTs signed with `jose` (the one auth dependency),
  secret in `AUTH_SECRET` (32+ characters, read lazily so the build and public
  pages work without it). Lifetimes: access 15 minutes, refresh 30 days. Both
  live in httpOnly, SameSite=Lax cookies; tokens are never in response bodies.
- Sign-in is rate-limited in the database (`failed_sign_ins`): 5 failures per
  email or 20 per IP in 15 minutes refuse further attempts before the password
  is checked. Public pages never read the session; only `/admin` does.
- The single admin account is created by a seed script; there is no public
  sign-up for admins.
- Migration style: one table per file; Sequelize API (`createTable`,
  `addConstraint`, `addIndex`), not raw SQL; `Sequelize.literal` only for
  checks that need a function or compare columns; `up` in a transaction;
  timestamps default with `Sequelize.fn('now')`, never `Sequelize.NOW`.
- Error tracking: not yet decided.

## Design (confirmed)

- Style: clean and minimal. White space, neutral surfaces, one primary color.
- Palette is modelled on the Lebanese University website and lives in the shadcn CSS
  variables in `src/app/globals.css`:
  - Light primary: deep blue `#3E4EB8` (white text on it). Links and active states use it.
  - Bright blue `#5473FF`: fails WCAG AA for small text on white, so it is the primary
    in the dark theme and is used for large or decorative elements only.
  - Yellow `#FDB91F`: decorative only (a short 4px bar under page titles). Never text.
  - Light theme: headings `#41454F`, body text `#575757`, page `#F5F5F5`, muted `#F8F8F8`,
    cards white. The dark theme uses dark neutral surfaces with light text.
  - Text contrast is at least 4.5:1 in both themes.
- Theme: light and dark, defaults to the device setting, toggle in the top bar.
- UI language: English only.
- Navigation adapts to the device. Phone: slim top bar plus a fixed bottom tab bar
  (Browse, Exams, Search). Desktop (md and up): the same items inline in the top bar and a
  breadcrumb trail on inner pages. Items without a page yet are shown disabled.
- Home is a landing page: headline, short description, "Browse courses" button, three
  benefit points, then the semester cards. No claims about features that do not exist.
- Course page: one tab per resource type that has resources, with its count.
- Exams page (`/exams`): filters (semester, course, academic year, session) live in the URL, so
  views are shareable and Back works. A plain GET form with an Apply button works without
  JavaScript; with JavaScript a dropdown change submits automatically. Unusable URL values are
  ignored, not errors. Results are one flat list (newest year first), 20 per page, reusing the
  course-page resource row. Dropdowns only offer values that have a visible exam.
- Branding is the plain text "University Assistant". No university logo, crest or name as
  branding. The footer says: "Independent student project. Not an official Lebanese
  University website."

## Engineering rules

- Work in small vertical slices that leave the app working and deployable.
- Keep pull requests small and easy to review: one task, one concern, one PR. If a
  plan is too big to review comfortably in one sitting, split it into separate
  tasks before any code is written, each with its own PR and each leaving the app
  working. Do not bundle refactors, dependency changes or unrelated fixes into a
  feature PR.
- No new dependency without a stated reason. Update `docs/dependencies.md` whenever
  a dependency is added or removed.
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
