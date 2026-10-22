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
- Read every resource on a page of our own (the reader), and download it.
- Admin-only upload and tagging of resources (one at a time, or in bulk per course).
- Student sign-up with email confirmation (pulled forward by the owner, 2026-10-21).

After launch, in this order:
- Bookmarks, explicit "mark as done".
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
- Every resource has a stored file (owner's decision, 2026-10-13). A link is
  never the resource itself: `external_url` is an optional backup shown beside
  the file. A resource cannot be published without a file; a draft may be
  saved without one.
- Every resource opens inside the platform, on a reader page of our own, not by
  sending the student away: the file shown in the page, a Download action, an
  action to open the file outside the reader, and room for the AI assistant
  planned for after launch to help while they read. The reader is part of the
  MVP. The reader exists (`/resources/ID`); the open route, which redirects to
  the material, now serves "Open outside the reader". That action opens the
  file itself in a new tab; the backup link, when there is one, is shown
  separately.
- When a requirement is ambiguous, ask; do not invent product behaviour.

## Domain model (proposed)

- All ids are UUIDs (`gen_random_uuid()` default in the database); foreign keys are
  UUIDs and services treat every id as a string.
- Course: unique course code, title, semester (3–6).
- Resource: belongs to one course. Type (lecture, notes, exercise, exam,
  solution, other), title, description, academic year, exam session
  (partial, final, second — exams only), language (en, fr), stored file
  (required to publish), optional backup link,
  optional link to the resource it is a solution of, optional chapter of the
  same course (never on exams; a resource with no chapter is listed under
  General), published flag.
- Chapter: belongs to one course; position unique within the course; title.
- User: email (stored lowercase), optional name, password hash, role
  (student or admin), `email_confirmed_at` (null until the emailed link is used;
  signing in needs it; the seeded admin and demo student are confirmed).
- EmailConfirmation (`email_confirmations`): belongs to a user; SHA-256 hash of the
  link token, expiry (24 h), used-at. Single use; the raw token is never stored.
- RateLimitEvent (`rate_limit_events`): action (`sign-up` per IP, `confirmation-email`
  per address), subject, time. No link to users; rows older than 2 days are pruned.
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
  `down`). Postgres full-text search (with the `unaccent` extension); no separate search service.
- Package manager: npm. Node 22+. `@types/node` is kept at 24.
- S3-compatible object storage for files, delivered through short-lived
  signed URLs. All storage access goes through one interface in
  `src/lib/storage` with two drivers: Cloudflare R2 in production and a local
  folder for development, tests and CI, so nothing needs the cloud to run.
  Browsers upload straight to storage through a signed URL (a Vercel function
  cannot receive a large request body); the server then checks what arrived.
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
  is checked. Public pages never read the session on the server (only `/admin`
  does); the header account control asks `GET /api/v1/auth/me` from the browser
  after the page has loaded.
- The single admin account is created by a seed script; there is no public
  sign-up for admins.
- Migration style: one table per file; Sequelize API (`createTable`,
  `addConstraint`, `addIndex`), not raw SQL; `Sequelize.literal` only for
  checks that need a function or compare columns; `up` in a transaction;
  timestamps default with `Sequelize.fn('now')`, never `Sequelize.NOW`.
- Email: a Postgres `email_jobs` queue processed with `after()` and a daily Vercel Cron sweep
  (`/api/cron/email-jobs`, `CRON_SECRET`); Brevo in production, a log driver off Vercel; payloads never
  hold secrets. See `docs/backend-architecture.md`.
- Error tracking: Sentry (`@sentry/nextjs`), errors only, nothing personal attached, browser SDK loaded lazily; enabled only when a DSN is set (production on Vercel), a no-op everywhere else.

## Design (confirmed)

- Style: clean and minimal. White space, neutral surfaces, one primary color.
- Palette is modelled on the Lebanese University website and lives in the shadcn CSS
  variables in `src/app/globals.css`:
  - Light primary: deep blue `#3E4EB8` (white text on it). Links and active states use it.
  - Bright blue `#5473FF`: fails WCAG AA for small text on white, so it is the primary
    in the dark theme and is used for large or decorative elements only.
  - Yellow `#FDB91F`: decorative only (a short 4px bar under page titles). Never text. The one other
    use (owner-approved in the reader mockup) is a pale yellow background behind text for search
    highlights in the reader; the text itself is never yellow.
  - Light theme: headings `#41454F`, body text `#575757`, page `#F5F5F5`, muted `#F8F8F8`,
    cards white. The dark theme uses dark neutral surfaces with light text.
  - Text contrast is at least 4.5:1 in both themes.
- Theme: light and dark, defaults to the device setting, toggle in the top bar.
- UI language: English only.
- Navigation adapts to the device. Phone: slim top bar plus a fixed bottom tab bar
  (Browse, Exams, Search). Desktop (md and up): the same items inline in the top bar and a
  breadcrumb trail on inner pages. An item without a page would be shown disabled. The top bar
  also shows a "Sign in" link or, when signed in, an account button with the user's name
  (never the email) and a menu with Admin (admins only) and Sign out.
- Home is a landing page: a hero (headline, description, "Browse courses" and "Previous exams"
  buttons, three facts, and a decorative course preview), a numbers strip (only from 5 courses), the
  semester cards (an empty semester is a muted card, not a link), how it works, what you will find,
  an "Exams coming up?" band with a link per session, and four questions. Only the strip and the
  cards read the database. No claims about features that do not exist.
- Course page: for a course with chapters, three areas, one visible at a time and chosen by
  links that live in the URL: Chapters (default), Previous exams (`?tab=exams`) and Other
  material (`?tab=other`, only when there is material with no chapter). Chapters are cards, each
  linking to its own page (`/courses/CODE/chapters/N`) and saying what is inside; an empty
  chapter is shown muted, not as a link. In the Previous exams area, exams are grouped by
  academic year (newest first) and each row is led by its session. A course without chapters
  shows one tab per resource type that has resources, with its count.
- Exams page (`/exams`): filters (semester, course, academic year, session) live in the URL, so
  views are shareable and Back works. A plain GET form with an Apply button works without
  JavaScript; with JavaScript a dropdown change submits automatically. Unusable URL values are
  ignored, not errors. Results are one flat list (newest year first), 20 per page, reusing the
  course-page resource row. Dropdowns only offer values that have a visible exam.
- Search page (`/search?q=…&type=…`, public, never reads the session; opened by the Search nav
  item; there is no other search box). It searches course codes and titles, chapter titles and
  the title and description of published files, not the text inside PDFs. Matching ignores case
  and accents, treats every word as a prefix ("algo" finds "Algorithms") and finds a course code
  with or without a space ("demo 301"); there is no typo tolerance. The query and the chip live in
  the URL; results follow the typing after about 300 ms (`router.replace`, no history entry per
  keystroke), and without JavaScript it is a plain GET form with a Search button. Under 2
  characters it shows hints and the four semester links. Results are Courses, Chapters and Files
  (the course-page resource row), each with its count and its top 5 plus "Show all N files"
  (`&show=files`, 20 per page); empty sections are hidden. Words that name a type, session or year
  ("exam", "cours", "final", "partiel", "2024", "2024-2025"; a session word only with a year or
  type word, or alone: "partial derivatives" is text) also filter Files, are not searched
  as text and are not highlighted, and show "Showing final exams from 2024-2025 · N results"; a
  type word selects its chip. Chips: All, Courses, Lectures & notes, Exercises, Exams (solutions
  and other files appear only under All). Matches are bold heading-colour text with no background
  (never yellow); a file matched only in its description shows a snippet. No results: the tips,
  a link to drop the chip, and Browse courses / Previous exams.
- Reader page (`/resources/ID`, public, published resources only; anything else is the 404 page):
  PDF.js draws every page of the file on canvases in one vertical scroll, drawn lazily. The document
  dominates the page: a card with a top row (only Contents on the left and Search and "More actions"
  on the right; nothing else goes there) and the pages on a muted reading surface. Each drawn page
  also has PDF.js's own text layer over it (invisible text, so text can be selected and copied and a
  screen reader can read it; built only for pages near the screen, scaled with the zoom; a scanned
  page simply has none). Search ("Search in document", or Ctrl+F / Cmd+F, which replaces the
  browser's find on this page) opens a bar under the top row: a box, "3 of 17" or "No matches",
  previous / next (Enter / Shift+Enter) and close (Esc; the focus goes back to the Search button
  however it was closed). It matches ignoring case, accents and runs of white space ("ete" finds
  "été") and joins a word split by a hyphen at a line end, on the text PDF.js extracts. That text is
  read and folded lazily, page by page, the first time a search runs, and kept (a page that failed
  to read is retried by the next search); typing is debounced; the current match is highlighted
  strongly and centred, the others softly, on the pages that are drawn. Contents toggles a ~200px
  panel left of the pages on desktop (open or closed is remembered in `localStorage`,
  `reader:contents-open`) and a sheet from the left on a phone; it lists the PDF's outline (nested,
  with page numbers) and, for a file without one, a thumbnail of every page; the entry for the page
  being read is marked. Every jump to a page (Contents, previous / next, the page box, a search
  match's page) puts the top of the page at the top of the reading area with a small gap, also when
  the layout changes during the jump. One floating bar holds previous / next, the page number (a box
  you can type into on desktop, plain "3 / 12" text on a phone) and zoom out / percentage / zoom in.
  On a phone this bar shows for a few seconds on load, then hides by itself; a tap on the pages (not
  a scroll, pinch or long-press) shows or hides it, and it hides a few seconds after its last use
  (never while a menu is open or keyboard focus is in it); on desktop it is always visible. Zoom
  levels are 50 to 300% (100% is the PDF's real size); the default is "Fit width" (on wide screens
  the page stops at 880px so it sits centred on a grey surface), and "Fit page" shows a whole page;
  the percentage shown in a fit mode is the computed one, and zoom steps leave the fit mode. Zoom
  keeps the reader on the same page. The "More actions" menu (a dropdown on desktop, a bottom sheet
  on a phone) has Fit width, Fit page, Focus mode, Download and Open outside the reader. Focus mode
  makes the card cover the whole viewport (and asks for real fullscreen where available, but does
  not depend on it); Esc leaves it (or closes an open search first). Keys (when not typing): arrows,
  PageUp/PageDown, Home/End, `+`/`-`, `0`. The page being read is remembered per resource in
  `localStorage` (`reader:last-page:ID`), and a later visit offers "Continue where you left off,
  page N?" once; this is a position only, never progress. Desktop (md and up): breadcrumb ending at
  the course area that lists the resource, the title with its type and language on one line, the
  card at a fixed height with the pages scrolling inside it, and a narrow details column (plain text
  under small headings) beside it. Phone: a back link (the course code) above the title, the card's
  top row sticky under the site bar with the window scrolling the pages, then the details below.
  Back leads to Previous exams for an exam, to the chapter page for a resource in a chapter,
  otherwise to the course (Other material when the course has chapters). Resource rows and solution
  links on public pages open the reader in the same tab. There is no AI panel yet and no text about
  one.
- Sign-in page (`/sign-in`): a split card. On desktop (md and up) a deep-blue panel (the `brand-panel` token, white text, same in both themes) with the brand name, the home headline and three feature lines sits beside the form; on a phone the brand name sits above the form and the panel is hidden. The form shows errors in one destructive alert, clears and focuses the password after a wrong one, has a show/hide password button and a Caps Lock hint. The layout is `AuthShell` in `src/components/auth`.
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
  under generated keys, never under user-supplied names. Uploads are PDF only, at
  most 50 MB.
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
