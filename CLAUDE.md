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
- Semesters covered: S1–S8: the three years of the programme (S1–S6, owner, 2026-11-18) and Master 1 (S7–S8, #154). Students browse by year;
  spec `docs/specs/browse-by-year.md`. Inside a year students see "Semester 1" / "Semester 2", never the
  stored 1–8 number (owner, 2026-11-22; all pages follow it: Home, year pages, breadcrumbs, Exams, Search,
  Progress, Saved and admin, with `courseYearSemesterLabel` in `src/lib/years.ts` giving "Second year · Semester 1"). Master 1 (stored semesters 7–8, `/years/m1`, "Master 1 · Semester 1") is the fourth year
  (`Year` 4 internally; students never see the 4: label "Master 1", slug `m1`, circle text "M1" from `yearBadge`).
- Built and operated by one developer, who is also the only admin and the only
  person who uploads content.
- Target: usable MVP live before partial exams (around early December 2026).

## MVP scope

In:
- Browse years → courses → resources, grouped by resource type.
- Previous exams filterable by course, academic year and session.
- Search over course codes, titles and resource metadata.
- Read every resource on a page of our own (the reader), and download it.
- Admin-only upload and tagging of resources (one at a time, or in bulk per course).
- Student sign-up with email confirmation (pulled forward by the owner, 2026-10-21).
- Saved resources and a private to-do board, for signed-in users only (pulled forward by the
  owner, 2026-10-24; terms in `GLOSSARY.md`).
- Explicit "mark as done" and progress tracking, for signed-in users only (pulled forward by the
  owner, 2026-10-27; spec `docs/specs/progress-tracking.md`, terms in `GLOSSARY.md`).

After launch:
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
  approved its use. The faculty approved it (owner, 2026-11-16), so real material may be published.
- Seed data is placeholder during development: obviously fake course codes,
  titles and resources (first-year demo courses: DEMO110 in semester 1 and DEMO210 in semester 2, a few files each, no chapters, nothing of the demo student's). The real course list and files are loaded in a
  separate data-gathering phase; do not ask for them or invent real-looking
  ones before then. The seeded demo student has a few completions (DEMO610: chapter 1 finished, two files of chapter 2,
  one exam; DEMO410: one lecture) and active days (today and up to two earlier days of the current Beirut week) so demos show progress; e2e specs that mark files must not use those courses.
- Real content source (owner, 2026-11-14): the real files come from the local folder
  `~/Computer Science Resources`, one folder per semester (`Sem 5`, ...) and inside it one
  folder per course named "CODE - Name" (e.g. `I3305 - GUI`). Content is loaded through the
  platform's admin pages (upload), never committed to the repo or seeded.
  Master 1 material comes only from the Google Classroom
  https://classroom.google.com/c/ODk4Nzg5NDA0MDQx (owner, 2026-11-22); that Classroom is not a
  source for S1–S6, and Master 1 is not taken from the Drive folders. It needs the owner's Google
  sign-in, so it is read through the browser.
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
- Course: unique course code, title, semester (1–8). The year is derived from the semester, never stored: 1–2 first year, 3–4 second, 5–6 third, 7–8 Master 1 (`src/lib/years.ts`; terms in `GLOSSARY.md`).
- Resource: belongs to one course. Type (lecture, notes, exercise, exam,
  solution, other), title, description, academic year, exam session
  (partial, final, second — exams only), language (en, fr), stored file
  (required to publish), optional backup link,
  optional link to the resource it is a solution of, optional chapter of the
  same course (never on exams; a resource with no chapter is listed under
  General), optional lecturer (`lecturer_id`, see Lecturer below; `lecturerId` on every resource write, a malformed or unknown id is a 400 field error on `lecturerId`; `null` clears it), published flag, and the text check of its file: `page_count` and `text_page_count` (both null
  when not checked). A page has text with at least 30 non-whitespace characters (PDF.js); no text page is
  Scanned, some is Partly scanned, derived and never stored. The admin's browser checks at upload and sends it
  with the file ticket; a replaced file without a check resets both to null. Admin-only badge and filter; it
  never blocks saving or publishing. `npm run text-layers:check` backfills stored files.
- Chapter: belongs to one course; position unique within the course; title.
- Lecturer (`lecturers`): the person who taught or wrote a resource, named as written ("Dr. Ali Ghorayeb"); `name` (1 to 100 characters, trimmed, inner whitespace collapsed, unique ignoring case through a `lower(name)` index), `slug` (unique, made from the name once at creation and never changed by a rename: accents removed, lowercase, a leading Dr. / Pr. / Prof. dropped, other runs one hyphen, `-2`, `-3` on a clash). `resources.lecturer_id` is optional, indexed, a foreign key with `ON DELETE RESTRICT`: a lecturer that any resource, draft or published, uses cannot be deleted. Spec: `docs/specs/lecturer-filter.md`.
- User: email (stored lowercase), optional name, password hash, role
  (student or admin), `email_confirmed_at` (null until the emailed link is used;
  signing in needs it; the seeded admin and demo student are confirmed), `blocked_at` (null unless
  the admin blocked the account; blocking revokes all its refresh tokens; sign-in with the right password
  answers 403 `account_blocked` and refresh/restore refuse; sign-up and resend for the address do nothing;
  the unconfirmed-account cleanup keeps blocked rows; an admin account cannot be blocked).
- EmailConfirmation (`email_confirmations`): belongs to a user; SHA-256 hash of the
  link token, expiry (24 h), used-at. Single use; the raw token is never stored.
- RateLimitEvent (`rate_limit_events`): action (`sign-up` per IP, `confirmation-email`
  per address), subject, time. No link to users; rows older than 2 days are pruned.
- RefreshToken: belongs to a user; token hash, family id, expiry, revoked-at.
- FailedSignIn (`failed_sign_ins`): normalised email, IP, time. Only failures are
  stored; no link to users, so unknown emails are counted too. Old rows are pruned.
- Bookmark and Completion: each one row per (user, resource). A completion
  means the student explicitly marked the resource done; un-marking deletes it.
  A bookmark is shown to students as a "Saved resource". Only a published lecture, notes, exercise or
  exam can be marked done (`src/services/progress`, `isMarkable`); un-marking always works. Progress is
  computed live from completions of published files, never stored: counted resources (lecture, notes,
  exercise) make chapter and course progress, exams are counted apart, solutions and other in no number.
- StudyDay (`study_days`): an active day. Belongs to a user (cascade); `day` is a Beirut (Asia/Beirut)
  calendar date; unique per (user, day). Recorded by `markDone` inside the mark's transaction, only for a new
  completion (`src/services/progress/beirut-date.ts` gives the date); never removed, so un-marking keeps it.
- Milestone (`milestones`): an achievement a student earns once and keeps. Belongs to a user (cascade); `key`
  (check constraint, `MILESTONE_KEYS` in `src/db/constants.ts`: `first_file`, `files_10`, `files_50`,
  `first_chapter`, `first_course`, `all_exams_of_course`); `earned_at`; unique per (user, key). Awarded by
  `markDone` inside the mark's transaction, only for a new completion, and never removed (un-marking and content
  changes leave it). File counts use completions of currently published markable files; chapter, course and
  exams milestones are evaluated only within the marked file's course (deliberate, to keep a mark cheap);
  `all_exams_of_course` needs at least one published exam, all completed.
- Todo (`todos`; a "card" in the interface): a card on a student's to-do board. Belongs to a user
  (cascade); status (todo, in_progress, done; check constraint), position within its status (0 is
  the top, renumbered on write), title (≤200, "" allowed in the table: the service requires a title
  unless a resource is linked), note (≤2000, "" when none), optional resource (only a published one can be linked, else 404; set to null if the
  resource is deleted; a card whose resource is later unpublished shows it as unavailable), created/updated/status-changed times, soft-delete time (kept a day so
  Undo works; the user's old ones are purged whenever their board is loaded). At most 500 live
  cards per user (`BoardFullError`, 409 `board_full`). Moving a card into Done from another column
  marks its linked file as done in the move's transaction (only an available lecture, notes, exercise or exam); moving a card
  out of Done, within Done, creating or restoring a card, or linking a file to a card already in Done never marks or un-marks one. Spec: `docs/specs/saved-and-todo.md`.

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
- Toasts (short messages such as "Saved.", with an optional Undo) use shadcn's Sonner, mounted once in
  `SiteChrome` at the top centre so a toast never covers the to-do board's `+` button or the reader's floating bar.
- Zod for validating all external input.
- Vitest for unit/integration tests, Playwright for the core user journeys.
- Hosting: Vercel (app), Neon (Postgres), Cloudflare R2 (files).
- Auth (owner's decision): email and password, with short-lived stateless
  access tokens and long-lived refresh tokens. Refresh tokens are stored only
  as SHA-256 hashes in `refresh_tokens`, rotated on every use, and grouped by
  `family_id` so a reused token revokes its whole chain. Our own tables and
  code; no auth framework.
- A readable hint cookie `ua_signed_in=1` (not httpOnly, SameSite=Lax, path `/`, the refresh token's lifetime) is set and cleared inside
  `setSessionCookies` / `clearSessionCookies`, so sign-in, refresh, restore, sign-out and a failed refresh keep it in step. It holds nothing
  personal and is never trusted: no server code reads it for authorization. It exists only so Home can reserve the Home card's space
  before paint (see Home); a stale one is harmless.
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
  (`/api/cron/email-jobs`, `CRON_SECRET`); Resend in production (sending from a verified subdomain such as `mail.unimate-fs.online`), a log driver off Vercel; payloads never
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
  - Success green (`--success` / `--success-foreground`: `#166534` on white text in light, `#4ADE80`
    on `#0B1A10` text in dark; 7.1:1 and 10.3:1): for Done on the to-do board (column bar,
    check marks, Done button) and for Done / finished progress (the reader Done button, row checks,
    finished chapters and courses). Not a general positive colour; progress in flight uses the primary.
  - Light theme: headings `#41454F`, body text `#575757`, page `#F5F5F5`, muted `#F8F8F8`,
    cards white. The dark theme uses dark neutral surfaces with light text.
  - Text contrast is at least 4.5:1 in both themes.
- Shared design language (spec #179, calm and friendly; owner-approved on the home prototype, 2026-11-25): defined once in
  `src/lib/design-language.ts` (`YEAR_STYLES`, `TYPE_STYLES`) with `YearCircle` / `YearChip`
  (`src/components/site/year-badge.tsx`) and the `rise-in` utility in `globals.css`; no page hard-codes its own year or
  file-type colours. Status: the foundation is in (#180: the module, the row's type colour and name, `rise-in`); pages adopt
  year colours and the other styles ticket by ticket (#181 to #191). Each year has its own colour on every page (first sky, second violet, third emerald, Master 1
  amber; solid for circles and tabs, a tinted chip, a hover border); each file type has its own colour and icon on
  every resource row (lecture blue book, notes teal document, exercise orange pencil, exam rose clipboard; solutions
  and other stay neutral). A `ResourceRow` tints its icon box with the type colour and names the type in a chip beside
  the language badge (also in lists already grouped by type, and on exam rows), never colour alone. Surfaces are flat
  with large radii; no gradient text, no gradient card fills, no floating decorative cards, no emoji. The only
  decorative animation allowed is a soft blurred background behind the home hero; `rise-in` (set `--rise-delay` to
  stagger) exists only under `prefers-reduced-motion: no-preference`, and hover lifts use `motion-safe:` variants. Primary blue stays the brand and
  action colour, success green still means done or finished only, yellow stays decorative. Text on tinted chips keeps
  4.5:1 in both themes. Each redesign ticket (#181 to #191) applies it to its pages.
- Theme: light and dark, defaults to the device setting, toggle in the top bar.
- UI language: English only.
- Navigation adapts to the device. The items are Browse, Exams, Search, Saved, To-do and Progress, shown to
  everyone (signed out, Saved, To-do and Progress lead through sign-in and back; the bar never waits for the
  session). Phone (below md): there is no bottom bar. The top bar has a hamburger at the far left (`aria-label`
  "Open menu", at least 44px), then the brand, with the theme toggle and account at the right. The hamburger opens a
  left sidebar (`MobileNav`, `src/components/site/mobile-nav.tsx`, the shadcn `Sheet`, 280px, at most 85vw):
  the brand and a "Close menu" button at the top, then `nav[aria-label="Main"]` with a "Study" group (Browse,
  Exams, Search) and, under a divider, a "Your pages" group (Saved, To-do, Progress; Progress after To-do, owner
  decision 2026-10-28), icons as on desktop, nothing else. The current item has `aria-current="page"`, link-coloured
  text, a light primary tint and a 4px primary bar on its left edge. It closes on an item tap, the backdrop, Esc or
  the close button, focus is trapped while open and returns to the hamburger, and the content mounts only while
  open (one Main nav is exposed at a time). It is the same item list as desktop (`NAV_ITEMS` in `nav-items.tsx`).
  Nothing is reserved at the bottom of the page for it; the to-do `+` button and the reader's floating bar are
  anchored to the screen bottom with `env(safe-area-inset-bottom)`. Desktop (md and up): the same items inline in the
  top bar (six, Progress after To-do), Saved, To-do and Progress after a thin divider, the current item underlined in primary along the bar's
  bottom edge (icons from lg up), and a breadcrumb trail on inner pages. An item without a page would be shown disabled. The account pages (sign-in, sign-up, check-email, confirm-email) are the exception: see the Sign-in page bullet. The top bar
  also shows a "Sign in" link or, when signed in, a round avatar with the user's initials (a person icon
  without a name), labelled with the name (never the email). Its menu holds the account only: the name,
  Admin (admins only) and Sign out; pages never go in it.
- Page width: every site page, the header and the footer use the `page-container` utility (`globals.css`): content up to 1280px (`max-w-7xl`), centred, side padding 16px on a phone, 24px from sm, 32px from lg, so the edges never move between pages; the reader follows it too. The account pages keep their full-screen split.
- Home (spec #179, tickets #181 and #182; more sections arrive with #183 and #184): a hero card, then "Choose your year". The hero
  (`hero.tsx`) says "Computer Science · Faculty of Science · Hadath", the headline "Find any course, exam or lecture.", one
  plain line, a real search field and two buttons, "Previous exams" (to `/exams`) and "Choose your year" (to `#years`). The
  field (`home-search.tsx`, `role="search"`, label "Search courses, chapters and files") is a plain GET form to
  `/search` with `q`, so it works without JavaScript: typing stays on the page, Enter or the "Search" button opens
  `/search?q=WORDS`. A rotating hint (`.hint-cycle`, "Course code or topic", "Try: final 2025", "Try: graphs", "Try:
  partial") shows only while the field is empty and is `aria-hidden`; under reduced motion it shows its first line.
  A soft coloured background (three blurred blobs, `.hero-blob`) drifts behind the hero only and stops under reduced
  motion. The long "How it works", "What you will find", "Exams coming up?" and FAQ sections, the old numbers strip and the
  decorative course preview are gone (the independent-project statement stays in the footer). Home stays static and
  never reads the session on the server: a readable hint cookie (`ua_signed_in`, see Stack, Auth) is read by an inline
  script in the root layout's `<head>` before paint (`SIGNED_IN_SCRIPT`, `src/lib/auth/signed-in-hint.ts`, same test as
  `hasSignedInHint`), which sets `html[data-signed-in]`, `--home-band-h` from `localStorage["home:band-h"]` (the
  card's last measured phone height) and `--home-band-h-wide` from `localStorage["home:band-h-wide"]` (its last measured
  height from md up), each kept when 80 to 800. CSS then reserves a card slot of that height (defaults 28.5rem below md,
  18.75rem from md up; a visitor's slot is `display: none`, so it takes no space and leaves no gap) so the card fills it
  without moving the years (the slot, `ProgressBand`, `data-personal`, removes
  the marker when the session check answers signed out or the progress request fails, or after 8 s without an answer
  (`LOADING_GIVE_UP_MS`; a band arriving later then moves the years once); it sets it when a band shows, follows sign-in
  and sign-out events and stores the measured height, under the key for the width it was measured at). A visitor without the hint gets the static page and no
  extra request. The hint only drives CSS. Order: desktop hero, band, years; phone a visitor sees hero, years, numbers row; a
  signed-in student band, hero, years, numbers row (`.home-*` rules in `globals.css`; no content is rendered twice).
- Home "Recently added" and previous-exam shortcuts (ticket #183; `recent.tsx`, in the same Suspense boundary as the year
  cards, after the numbers row on desktop and phone, `.home-recent` / `.home-exams` order 5 and 6 below md): "Recently added" is a
  region of the newest published files (`listRecentResources(null)` in `src/services/resources/recent.ts`, newest
  `createdAt` first, `RECENT_LIMIT` 6, the visitor's view so a draft never shows; no schema change), two columns from sm, each
  a 56px-tall link to the reader with the type's icon box in its type colour, the title, "CODE · Lecture · 2 days ago"
  (`<time>`, relative to the render, so on the static page it is as old as the last build) and a "See all" link to
  `/search`. With fewer than `RECENT_MIN` (3) files the section hides itself. "Previous exams" is a region with three
  links, "Partial exams", "Final exams" and "Second session", to `/exams?session=partial|final|second`. Not a progress
  signal: nothing here reads the session or marks anything.
- Home year cards (`#years`, `year-cards.tsx`; the only part that reads the database, `getHomeStats()`; inside one
  Suspense boundary with `YearCardsSkeleton`): "Choose your year", one card per entry of `YEARS` (four: one column on a
  phone, two from sm, four from lg): the year circle (`YearCircle`, year colour) and "Second year", up to four
  course-code chips in the year's tint and "+N more", "7 courses · 101 files" and "Open →", lift and the year's border
  on hover, rising in as the page loads; a year with no course is a muted dashed card, not a link, "No courses yet";
  wording in `year-card.ts`. Under the cards, the numbers row (`#numbers`, a region labelled "In numbers", `StatsRow` in
  `year-cards.tsx`, wording in `stats-row.ts`, from `getHomeStats().totals`; it replaced the "Jump straight to a course"
  browser, owner 2026-11-25): four tiles that are not links, "1,204 files", "42 courses", "156 previous exams" and
  "2015–2025 exam years covered" (`totals.examYears`: the first and last `academic_year_start` of a visible exam, shown
  from the first year's start to the last year's end), counts in `en-US` digits and agreeing with their noun; each tile a
  `rounded-3xl` card with a tinted icon box (brand tint; the exam tile takes the exam type's colour), the number large in
  the heading colour and the label muted. A 2x2 grid on a phone, one row of four from md up. Visible files only (the
  viewer is null, so drafts never count). The row is left out when there is no visible file, and both exam tiles when
  there is no visible exam (the span alone when no exam has a year). On a phone it comes after the years (`.home-stats`);
  `YearCardsSkeleton` covers it. A
  signed-in student also gets one card (`ProgressBand`, `data-personal`, flat, `rounded-3xl`, no gradient and no
  percentage bar) after the hero on desktop and first on a phone, loaded by the browser from `GET /api/v1/progress` after
  the page shows (Home stays static; a visitor gets no card and no request). It has three parts. First, "Continue where
  you left off": the last file read in this browser (`reader:last-read`, see the Reader page bullet), its title, "DEMO301 ·
  Lecture · Page 7" (the page only after the first, read from `reader:last-page:ID`) and a "Resume" button
  (accessible name "Resume TITLE, page 7") to `/resources/ID#page=7` (no hash for page 1 or none remembered); when
  nothing is remembered it says "Open any file and you can pick it up here next time." instead. It is read from
  `localStorage` after mount (`useSyncExternalStore`, no hydration mismatch). It is a place to continue from: no
  "page 7 of 24", no bar, no percentage, nothing derived from opening a file. Second, when the student has ever marked a
  file (`hasCompletions`, the rule of "This week" on `/progress`), the week row (`WeekDots`, `src/components/site/week-dots.tsx`,
  shared with `/progress`: a list labelled "This week", seven dots Monday to Sunday, items "Monday, active" / "Friday,
  today", primary only, no streak wording) and "N active days this week". Third, under a rule, "Your progress" with up
  to three of My courses by latest completion (ring, code, title, "x of y files · P%" or "✓ Finished", or "Exams: x of
  y done" for an exams-only course; these numbers come from explicit completions) and "See all ›" to `/progress`; with
  no My courses it says "Mark files as done in the reader to track your progress here." and leaves "See all" out. The
  card adds no animation. No claims about features that do not exist.
- Year page (`/years/1`, `/2`, `/3`, `/m1`, prerendered, any other value is the 404 page; `src/app/(site)/years/[year]/page.tsx`): breadcrumb
  Home › Second year, title "Second year", then an `h2` "Semester 1" (`id="semester-1"`, scroll margin) and "Semester 2"
  (`semester-2`), each with the course cards (code, title, "N resources", the signed-in progress ring from the one shared
  `GET /api/v1/progress` request) or "No courses yet.". Card content aligns to the top. A course with no visible file is a muted dashed card that is not a link, with "No files yet" instead of the count and no ring (#167). Students never see the stored semester number: `semesterInYear`,
  `semesterLabel` and `yearHref(year, semester?)` in `src/lib/years.ts` (the one place year URLs are built; anything
  that lists years iterates `YEARS`, so a fourth year can be added). Backed by `listCoursesByYear(viewer, year)`
  (`src/services/courses/courses.ts`; both semesters always present). The page never reads the session. Old
  `/semesters/1..8` links redirect permanently to `/years/Y#semester-K` (K = 1 for odd, 2 for even); other values are
  the 404 page. The Browse nav item is active on `/years/…`. Breadcrumbs of the course page, chapter page and reader read
  Home › Second year › …, the year crumb linking to `/years/Y#semester-K`.
- Back links on a phone (`BackLink`, `src/components/site/back-link.tsx`, below md only, 44px, ArrowLeft and the label): the course
  page shows "‹ Second year" (the year crumb's label and address, `yearCrumb`), the chapter page "‹ CODE" to the course (keeping
  `?lecturer`), the reader "‹ CODE" to its Back target. Desktop keeps the breadcrumbs (hidden below md).
- Course page: for a course with chapters, three areas, one visible at a time and chosen by
  links that live in the URL: Chapters (default), Previous exams (`?tab=exams`) and Other
  material (`?tab=other`, only when there is material with no chapter). Chapters are cards, each
  linking to its own page (`/courses/CODE/chapters/N`) and saying what is inside; an empty
  chapter is shown muted, not as a link. In the Previous exams area, exams are grouped by
  academic year (newest first) and each row is led by its session. A course without chapters
  shows one tab per resource type that has resources, with its count. Progress (signed-in
  student only, loaded by the browser after the page shows from
  `GET /api/v1/progress/courses/CODE`: `{ course: { code, title, done, total, finished }, exams: { done,
  total }, chapters: [{ id, position, title, done, total, finished }], general: { done, total, finished } }`,
  live, counted files only, exams apart; 401 signed out, 404 unknown code; a visitor makes no request,
  `useCourseProgress` in `src/lib/course-progress-client.ts` waits for the completions store and shares
  one request): a link card to `/progress` at the right of the title from md up (56px `ProgressRing`,
  "Your progress", "8 of 13 files done", "Exams: 2 of 6 done", the exams line left out with no exams) and,
  on a phone, only a 44px ring at the right of the course code line; aria-label "Your progress: 62%
  done, 8 of 13 files. Exams: 2 of 6 done." Nothing when the course has no counted file. The block is
  out of the flow and the title keeps `md:pr-80`, so nothing moves when it appears. Chapter cards with
  counted files show at the right of the "Chapter N" line "4 of 5 done", "Not started · 5 files" or a
  green "Finished", plus a 4px bar along the bottom edge (primary, success green when finished, which
  also tints the border); a chapter with no counted file shows neither, an empty card is unchanged.
- Taught by (course page and chapter page `/courses/CODE/chapters/N`; `taught-by.tsx`): when two or more lecturers have published
  files in scope (the course; the chapter on a chapter page), a "TAUGHT BY" strip (a list labelled "Lecturer") sits above the area tabs
  (above the lists on a chapter page): "All lecturers" (every published file in scope, files with no lecturer included) then one card per
  lecturer by name (40px initials circle, name, "N files", solutions counted). The chosen card has a primary border and tint, a filled
  circle and `aria-current="true"`. Below 5 lecturers: from sm up a 4-column grid, on a phone a sideways scroll row of 160px cards;
  from 5 lecturers (`SCROLL_ROW_FROM`) one sideways-scrolling row of 192px cards at every width, with the `scroll-fade` edge fade
  (`globals.css`; also on the type tabs of a course without chapters, which keep 24px of end padding so the fade only covers
  empty space: a fade at the end, and where scroll-driven animations
  exist the fades follow the scroll). The key is
  `?lecturer=SLUG` (`getCourseByCode` / `getChapterPage` take `{ lecturer }`; an unknown, malformed or draft-only slug is ignored). It
  narrows chapter cards (chapters left with none are left out, and cards describe only the kept files), previous exams, other material
  and the type tabs of a course without chapters; a kept row keeps its solution links; files with no lecturer show only with none chosen.
  Cards keep `tab`; the area tabs, chapter card links, Previous / Next / All chapters and the breadcrumb keep `lecturer`; the reader's Back
  link does not. A muted "Showing files by NAME only." with "Show all" appears while one is chosen. On a chapter page where the chosen
  lecturer has nothing, a state "No files by NAME in this chapter." with "Show all files", and no card is current. On the course page an
  area left empty by the choice says "No chapter has files by NAME.", "No previous exams by NAME." or "No other material by NAME."; the
  areas themselves (and the type tabs) do not change with the choice. A solution whose parent row is filtered out is listed on its own.
  Chapter Previous / Next skip chapters with none of the chosen lecturer's files. The initials use the shadcn `Avatar` and
  `lecturerInitials` (`src/lib/lecturer-name.ts`, which also holds the title rule the slug uses). Progress (block, rings,
  chapter text and bars, `/api/v1/progress`) ignores the filter. The page still never reads the session.
- Exams page (`/exams`): filters (semester, course, academic year, session, lecturer: a fifth dropdown, `?lecturer=SLUG`, "All" first, then lecturers with a visible exam by name; an unknown slug is ignored) live in the URL (`?semester=N` keeps the stored number; the Semester dropdown groups its options in native option groups "First year" / "Second year" / "Third year" / "Master 1" (one per entry of `YEARS`), each option "Semester 1" / "Semester 2", only semesters with a visible exam; the Course dropdown's groups read "Second year · Semester 1"), so
  views are shareable and Back works. A plain GET form with an Apply button works without
  JavaScript; with JavaScript a dropdown change submits automatically. The dropdowns are `PopoverSelect` (`src/components/ui/popover-select.tsx`, owner picked the simple popover look, 2026-11-24): a button that opens a small list under it (a search box above 8 options, group headings, the chosen value ticked), the value held in a hidden input; without JavaScript the button is hidden and a native select inside `<noscript>` is posted instead. Below md the five dropdowns and Apply
  fold into one native `<details>` disclosure (`filter-form.tsx`, `.filters-details` in `globals.css`) whose
  summary reads "Filters" or "Filters (2)" (`countActiveFilters` in `params.ts`, counted from the parsed and
  reconciled URL values, so unusable or dropped values do not count; the page number is not a filter); it
  starts closed, opens without JavaScript and stays open after an automatic submit. From md up the summary is
  hidden and the filters are always shown. The count line reads "117 exams · page 1 of 6". Unusable URL values are
  ignored, not errors. Results are one flat list (newest year first), 20 per page, reusing the
  course-page resource row, which here names the course by code and title before the file's title ("DEMO521 Algorithms · Final exam 2025"; `showCourse`,
  `courseTitle` on `ResourceListItem`, loaded in the same query as the rows). Course and chapter pages never repeat it. Dropdowns only offer values that have a visible exam.
- Search page (`/search?q=…&type=…`, public, never reads the session; opened by the Search nav
  item; the home hero also has a field that opens it with `?q=`). A course result says "Second year · Semester 1" before its chapter and file counts; a course with no files is the same muted, non-link card and says "No files yet". The chips row has the `scroll-fade` edge fade. It searches course codes and titles, chapter titles and
  the title, description and lecturer name of published files (the name is matched like the title
  but not highlighted, and adds no section), not the text inside PDFs. Matching ignores case
  and accents, treats every word as a prefix ("algo" finds "Algorithms") and finds a course code
  with or without a space ("demo 301"); there is no typo tolerance. The query and the chip live in
  the URL; results follow the typing after about 300 ms (`router.replace`, no history entry per
  keystroke), and without JavaScript it is a plain GET form with a Search button. Under 2
  characters it shows hints ("Try a course code, a topic (graphs), or an exam (final 2024).", no fake code) and "Or browse a year" with one link per year. Results are Courses, Chapters and Files
  (the course-page resource row, with the course's code and title as on Exams), each with its count and its top 5 plus "Show all N files"
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
  on the right; nothing else goes there, except an "Exit focus mode" button on a phone while focus mode is on) and the pages on a muted reading surface. Each drawn page
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
  on a phone) has Fit width, Fit page, Focus mode, then Save for later (or Remove from saved when it
  is saved), Add to to-do, Mark as done (or Mark as not done; only for a lecture, notes, exercise or
  exam), Download and Open outside the reader. Focus mode
  makes the card cover the whole viewport (and asks for real fullscreen where available, but does
  not depend on it); Esc leaves it (or closes an open search first), and on a phone, which has no Esc, an "Exit focus
  mode" button (44px, Minimize icon) sits in the top row while it is on (desktop keeps Esc and the menu). Keys (when not typing): arrows,
  PageUp/PageDown, Home/End, `+`/`-`, `0`. The page being read is remembered per resource in
  `localStorage` (`reader:last-page:ID`), and a later visit offers "Continue where you left off,
  page N?" once; this is a position only, never progress. An address ending in `#page=N` (N after the first page and
  inside the file, `pageFromHash`; anything else is ignored) jumps to that page once the reader is ready, shows no
  offer and removes the hash with `history.replaceState`; Home's Resume link uses it. The page also records the file
  itself in `localStorage` (`reader:last-read`: `{ id, title, courseCode, type, at }`, validated on read, written by
  `RememberLastRead` when a file with a stored file is shown; position only, never progress) for Home's card, and
  signing in (`SignInFields`) and both sign-out buttons clear it (`clearLastRead`, `src/lib/reader-position.ts`) so the
  next person on a shared browser does not see it. Desktop (md and up): breadcrumb ending at
  the course area that lists the resource, the title with its type and language on one line, the
  card at a fixed height with the pages scrolling inside it, and a narrow details column (plain text
  under small headings) beside it, with a full-width "Save for later" button at its top that becomes
  "Saved" (filled bookmark) once saved; pressing "Saved" removes it. Under it an outline "Add to to-do" button
  makes a card in To do linked to this file (toast "Added to To do" with "View board"; the same file may be
  added again; signed out it opens the sign-in dialog like Save, then adds the card). Under it, for a lecture, notes, exercise or exam
  only, an outline "Mark as done" button becomes a filled success-green "Done" (check icon,
  `aria-pressed`) once marked; pressing "Done" un-marks it. Last in that group, for a file with a stored file, a full-width
  outline "Download PDF" link (the same download route as the menu's Download, which stays; "Open outside the reader" is
  in the menu only); downloading never marks a file as done. Like Save it is optimistic, shares one browser
  store with the menu item (`src/lib/completions-client.ts`, `GET /api/v1/completions/ids` once per page
  load, only for a signed-in viewer), rolls back with a toast on failure, and signed out opens the
  sign-in dialog (see "Sign-in dialog for actions") and, after signing in, marks the file with the usual toast. Toasts, both with Undo: "Marked as done. Chapter 2: 4 of
  5." ("Marked as done." for an exam or a file in General) and "Marked as not done."; Undo itself shows no
  toast. A mark that is a new completion can also celebrate, decided by the server: the PUT response's
  `rewards` is `{ milestones, chapterFinished, courseFinished }`. `chapterFinished` is `{ position, title,
  nextChapter: { position, title } | null }` (the next chapter by position with a counted published file) when
  the mark left the file's chapter finished; `courseFinished` is `{ code, title, filesTotal, exams: { done,
  total } }` when it left the course finished (counted files only). Both are null on a repeated mark and for an
  exam, are computed live and play again whenever a new completion leaves the chapter or course finished (after
  un-mark and re-mark, or after new material is completed). Undo (a re-mark by Undo) celebrates nothing.
  The browser shows them through `celebrate` (`src/lib/celebrations.ts`, which the to-do board can call with
  the same result): course finished wins over chapter finished, which wins over the plain toast. Chapter
  finished: one toast replaces the plain one, "Chapter 2 finished!" with the chapter title and "all 5 files
  done.", an Undo button and, when there is a next chapter, a "Next chapter ›" button to
  `/courses/CODE/chapters/N`, plus a ~600 ms success-green ring (`done-ring`) on the reader's Done button.
  Course finished: the plain toast with Undo, and a dialog mounted once in `SiteChrome`
  (`CelebrationDialogHost`): a 64px success-green check, "DEMO301 finished", "You marked all 13 files of Demo
  Algorithms as done. Exams: 2 of 6 done." (no exams sentence when the course has none), "See your progress"
  (to `/progress`) and "Close"; it takes focus, closes with Esc or Close and gives focus back to the Done button
  (`data-done-button`); about 12 CSS confetti pieces in the brand colours fall over the page once (above the dim
  layer, `aria-hidden`, `pointer-events: none`). The ring and the confetti exist only under
  `prefers-reduced-motion: no-preference`; toasts and dialog are the same without it. A mark that earns a milestone then shows one more toast per milestone, "Milestone: 10 files done" with a
  "View" action to `/progress` (the server returns a key only the first time; an Undo takes nothing away). After a mark or un-mark the button is followed by a progress line and bar from the response:
  "Chapter 2: 4 of 5 files done", "Exams: 3 of 6 done" for an exam, or "DEMO301: 8 of 13 files done" for a
  file in General (the bar is primary, success green once finished). API: `PUT` / `DELETE
  /api/v1/completions/ID` (200 `{ created, progress, rewards: { milestones } }` / `{ progress }`; 404 for a file that cannot be
  marked) and `GET /api/v1/completions/ids`. Opening or downloading never marks a file. Phone: a back link (the course code) above the title, the card's
  top row sticky under the site bar with the window scrolling the pages, then the details below
  (so the Save button is below the card there).
  Back leads to Previous exams for an exam, to the chapter page for a resource in a chapter,
  otherwise to the course (Other material when the course has chapters). Resource rows and solution
  links on public pages open the reader in the same tab. Saving needs an account but the page stays
  public and never reads the session on the server: after load the browser asks
  `GET /api/v1/saved/ids` once (one shared store, `src/lib/saved-client.ts`, so the button and the
  menu always agree), and shows "Save for later" until the answer arrives. Saving is optimistic;
  it answers with the toast "Saved. Find it any time under Saved." ("Removed from
  saved." when removing), and a failure puts the state back with a toast. Signed out, the same
  controls show and using one opens the sign-in dialog over the page (see "Sign-in dialog for
  actions"); after signing in the tapped save is done with its usual toast. There is no AI panel yet and no text about one.
- Saved page (`/saved`): private, server-rendered, `noindex` and `no-store` (header set in
  `next.config.ts`), reached from "Saved" in the main navigation (also in the phone sidebar).
  `getSignedInPageViewer` (`src/lib/auth/page-guard.ts`) returns null without a valid access token, and the
  page then shows the in-page sign-in state (see "In-page sign-in state") instead of redirecting. Saved files are grouped by course (semester, then
  course code; "DEMO301 Title", the title limited to two lines, with "Second year · Semester 1" muted), newest save first inside a course, published
  files only (a withdrawn file simply disappears). Each item is the shared resource row (opens the
  reader in the same tab, solutions below) with its filled bookmark icon (see "Save bookmark on rows") and
  an "Add to to-do" icon beside it (`ListPlus`, label "Add TITLE to to-do", same action as in the reader). The icon
  removes the item: it leaves the page at once, with the toast "Removed from saved." and no reload,
  and a course with nothing left disappears. Empty state: a bookmark icon, "Nothing saved yet. Tap
  the bookmark on any file to keep it here." and a "Browse courses" button. `GET /api/v1/saved` returns the same
  groups.
- Progress page (`/progress`): private like `/saved` (server-rendered, `noindex`, `no-store`, `getSignedInPageViewer`; signed out it shows the
  in-page sign-in state), reached from "Progress" in the main navigation, after To-do, on phone and desktop (the course
  page's progress block also links to it). Breadcrumb Home › Progress, title "Your progress" with "Based only on the
  files you marked as done.", then My courses (courses with at least one completion of a published file) grouped
  under year headings ("Second year"; `groupCoursesByYear`), year then semester then code, in a 2-column grid from md up; each card shows its "Semester 1" muted above the figures. Each card: a ring (64px, 56px on a
  phone; a finished course is a full green ring with a check), the linked "CODE Title", and "8 of 13 files · Exams: 2 of
  6 done" ("Finished" in success green first when done; no exams part without exams; on a phone the exams part is on
  its own line); then one row per chapter with counted files, in position order, and "General" when it has counted
  files: "N · Title", a 6px bar (primary, green when finished) and "4/5" or "✓ 3/3". A finished course has a
  green-tinted border. Success green only means finished. The ring container is labelled "62% done, 8 of 13 files";
  bars are `aria-hidden`. Empty: "Nothing marked as done yet. Open a file and press Mark as done to see your progress
  here." and "Browse courses". Backed by `getProgressOverview` (`src/services/progress`; one grouped count over all My
  courses, sharing its counting with `getCourseProgress`) and `GET /api/v1/progress` (`{ courses: [{ code, title,
  semester, lastCompletedAt, course, exams, chapters, general }] }`). Year pages (`/years/N`) show a small ring
  (34px, `data-personal`, labelled "Your progress: 62% done") at the right of the course card of each started course,
  loaded by the browser after the page shows from the same `GET /api/v1/progress` (`useProgressOverview`, one request
  per page, none for a visitor); a finished course shows a check in the ring.
  "This week" panel above the course list (`this-week.tsx`; shown whenever the student has ever marked a file, i.e.
  `hasCompletions`, otherwise only the empty state): label "THIS WEEK", seven dots Monday to Sunday (Beirut time,
  28px, 30px on a phone) labelled M T W T F S S (`aria-hidden`). Active day: filled primary; today not active: 2px
  primary outline; today and active: filled with a ring offset; other days: 1.5px border outline. Under it "**3 active
  days** this week", "**1 active day** this week" or "No active days yet this week" (no zero, no streaks, nothing resets).
  The dots are a `ul` labelled "This week" whose items read "Monday, active" / "Tuesday" / "Friday, today". On desktop
  it sits in a 360px column. Primary only, never success green. `getProgressOverview(viewer, { now? })` also returns
  `week: { start (Monday), today, activeDays }` and `hasCompletions`, so `GET /api/v1/progress` has them too.
  Beside it (a grid `360px 1fr` from md up, under it on a phone; shown whenever "This week" is) sits "MILESTONES · n OF 6"
  (`milestones.tsx`): six items in a `ul` labelled "Milestones", each a 52px circle (symbols "1", "10", "50", Check,
  Star, ClipboardCheck, `aria-hidden`) with its label under it (12px). Earned: `bg-primary/10`, primary symbol and
  2px primary border, heading-colour label. Not yet earned: muted background, 2px dashed border, muted symbol and
  label (no "missing" or "locked" wording). Items read "10 files done, earned" / "50 files done, not yet earned".
  On a phone the row scrolls sideways (88px items, bleeding to the panel's right edge). Primary only. The overview
  also returns `milestones: { key, label, earnedAt | null }[]`, all six in order.
- Save bookmark on rows: every resource row (`ResourceRow`: course page areas and tabs, chapter pages,
  exams, search results, Saved) carries a bookmark button in its own cell at the right, outside the
  row link, 44px on a phone, always rendered so nothing moves when the state arrives. Outline when not
  saved, filled primary when saved; `aria-pressed`, label "Save TITLE" / "Remove TITLE from saved".
  Signed out it opens the sign-in dialog over the page, which saves the row after a successful sign-in. The pages stay
  static: the browser asks `GET /api/v1/saved/ids` once per page load (never for a visitor) and all
  icons share the answer; toasts are the reader's. The row's `action` slot is for extra controls
  beside the bookmark.
- Course on rows: a `ResourceRow` with `showCourse` (Exams and Search only) starts its title line with the course code and
  title, then a " · " hidden from screen readers (the link reads "DEMO401 Sample Course C Sample final exam 2024").
- Done status cell on rows: for a signed-in student every `ResourceRow` also has a read-only cell at the
  left (`DoneStatusCell`, outside the row link, `pl-3`, a 22px circle; not a button, not focusable).
  A completed file shows a filled success-green circle with a check (`role="img"`, label "Done"); a
  lecture, notes, exercise or exam not completed shows an empty circle with a 1.5px border (label "Not
  done"); solutions and other files, and every row while the answer is on its way, get an empty cell of
  the same width, announced as nothing. A visitor gets no cell at all. It reads the completed-ids store
  (`useDoneCell` in `src/lib/completions-client.ts`): the store has a `signed-in` state (known signed in,
  ids not back yet) set before the ids request, so the cell is reserved before the answer and nothing
  moves; all rows share one `GET /api/v1/completions/ids`, never made for a visitor. Rows in the
  "Solution" sub-link strip have no cell (their text stays at the old indent).
- To-do board (`/todo`): private like `/saved` (server-rendered, `noindex`, `no-store`, same
  `getSignedInPageViewer` and in-page sign-in state), reached from "To-do" in the main
  navigation (also in the phone sidebar). Look follows prototype variant D. Desktop (md and up): breadcrumb
  Home › To-do, a "New card" button (shortcut N, only when focus is not in a field and no modifier is
  held) and three tinted columns side by side, each with a coloured top bar, icon, label and count, and
  a friendly empty text; "Add a card" at the bottom of each column opens a
  small form with one title field: Enter adds the card and keeps the form open, an empty title does
  nothing, Esc or Cancel closes it and returns focus to "Add a card". Phone: three tabs (icon, label,
  count, coloured underline) show one column at a time, and a round 56px `+` button at the bottom right of
  the screen (safe-area aware) opens the form of the tab shown. A card has the note icon, the title, a
  two-line note preview when there is a note, and "Added 2 hours ago" (Done cards: "Done …" from the
  status-changed time, with a green check); times come from the server's clock at first render and
  refresh every minute. Adding is optimistic: the card appears at the top of its column at once, is
  replaced by the server's card, or removed with a toast ("Couldn't add the card. Try again." / "Your
  board is full (500 cards). Delete some done cards to add more."); a 401 renews the session once, then goes to
  sign-in. Requests are sent one after another so cards keep the order they were added in. API:
  `GET` / `POST /api/v1/todos` (`{ title, note?, status? }`, 201 `{ card }`, 400 `fields`, 409
  `board_full`). Card view: clicking a card (its title is a button stretched over the card) or
  Enter / Space opens one `CardViewDialog` owned by the board (a full-screen sheet on a phone). Left: a
  large one-line title and the note with "N / 2000"; right: the status as a list of the three columns (the current one marked, `aria-pressed`; choosing
  another moves the card to the top of it and the card view stays open), "Added" and "In this column since", and "Delete card". There is no Save button:
  about 500 ms after typing stops, `PATCH /api/v1/todos/ID` sends only the fields that changed
  (`use-card-saver`), one request at a time per card; a quiet line shows "Saving…", "Saved" or "Couldn't
  save, retrying" (retries after 1, 2, 4, 8 s, then every 15 s; only problems are announced to screen
  readers). Closing flushes at once; a hidden or closing page sends what is waiting with `keepalive`. A
  400 (an empty title on a note card) shows "A card needs a title." under the title, is not retried, and
  the board goes back to the last saved title. Delete: "Delete card" asks "Delete this card?" first; the
  "…" menu on each card has Delete with no question. Either hides the card at once and shows "Card
  deleted" with Undo for 5 seconds (`showUndoToast`, `src/lib/undo-toast.ts`, shared with moving);
  `DELETE /api/v1/todos/ID` (204) soft-deletes the card keeping its column and position, and
  `POST /api/v1/todos/ID/restore` puts it back there (or at the bottom of a shorter column; 409
  `board_full` at 500). Deleted cards are kept a day and purged when the owner loads the board. Focus
  returns to the card after the card view closes, and goes to the next card (or "Add a card") after a
  delete. Moving: a To do card has a "Start" button (to In progress) and an In progress card a green
  "Done" button (to Done); neither is on a Done card. Both are 44px tall on a phone and sit before the
  "…" menu in the Tab order. The menu has Move to (the two other columns), Move up, Move down (disabled
  at the ends), Open card and Delete. Start, Done, Move to and the card view's status list put the
  card at the top of the new column; its "since" date restarts. `POST /api/v1/todos/ID/move`
  (`{ status, index }`, 0 = top, clamped; 200 `{ card }`) renumbers both columns gapless in one
  transaction, and sets `statusChangedAt` only when the column changes. The board moves the card at
  once and rolls it back with "Couldn't move the card. Try again." if the server refuses; moves are
  queued with the other requests. Every move shows an Undo toast ("Moved to In progress", "Moved to
  To do", "Nice, that's done.", "Moved up", "Moved down"); Undo returns the card to its earlier column
  and place (its "since" date becomes the time of the undo) and is not itself undoable. A card that
  reaches Done gets a ~600 ms green ring and its check pops in (`done-ring`, `done-check` in
  `globals.css`, only under `prefers-reduced-motion: no-preference`; the toast still shows). Done cards
  have a struck-through title and "Done … ago". Moving a card into Done from another column
  also marks its linked file as done, when it is available, markable (lecture, notes, exercise, exam) and not done yet (see
  "Marking from the board" below). Moving out of Done or within Done never marks or un-marks. After a move the focus follows the card; on a phone, when it leaves the tab on screen,
  the focus stays on the selected tab. Linked files: a card made from "Add to to-do" (or `POST /api/v1/todos` / `PATCH /api/v1/todos/ID`
  with `resourceId`; `null` removes the link) shows the file as a tile under the title and note,
  like an attachment (no "Note" label): the type icon, the file's title (left out when the card has no title of its own, as the
  heading already is the file's title), the course code and type, and "Open ›". The whole tile is the link to the reader (same tab,
  above the title overlay, at least 44px tall on a phone; a press on it never starts a drag; Tab order: title, file tile, Start/Done, "…").
  A file no longer published shows a dashed tile with "This file is no longer available" and no link. With no title of its own
  the card shows the file's title; a file that was deleted leaves the card with its title and note
  ("A file that was removed" if it had neither); a file no longer published shows "This file is no
  longer available", never its title or a link. The card view's File section is always there (the title
  may be empty, with the file's title as placeholder). Without a file it has "Link one of your saved files";
  with one, a small file card with **Open** and **Remove** (for a file no longer published, Remove only).
  The composer has "Link a saved file" under the title field; the chosen file shows as a chip (icon, title, an
  × "Remove TITLE") and, with a file chosen, an empty title is allowed (the placeholder becomes the file's title)
  and Add card posts `resourceId`. Both open the shared `SavedFilePicker` (`saved-file-picker.tsx`): an inline list
  of the student's saved files from `GET /api/v1/saved` (loaded when first opened), grouped by course, each file a
  button with its type icon; empty: "Nothing saved yet. Tap the bookmark on any file to save it, then link it here.";
  error: "Couldn't load your saved files." with Try again; Cancel or Esc closes only the picker and focus returns to
  its button. Linking and removing go through the card's save queue and are sent at once (not after the 500 ms
  pause), shown optimistically; the server's card then replaces the file shown. Removing the file of a card with no
  title of its own sends the file's title with `resourceId: null`, so the card keeps a name; if the file is no longer
  published and the card has no title, Remove is disabled with "Give the card a title before removing the file.".
  A 404 when linking (the file was unpublished meanwhile) is not retried: the last saved file is put back with the
  toast "This file can no longer be linked." (in the composer: the optimistic card is removed with "This file can no
  longer be added."). Cards carry `resource`: null,
  `{ available: true, id, title, type, courseCode, done }` (`done`: the viewer has a completion of the file) or `{ available: false }`.
  Marking from the board: `POST /api/v1/todos/ID/move` answers `{ card, fileMarked, rewards, progress }`; `fileMarked` is true only
  when the move made a new completion, and `rewards` / `progress` (the progress service's shapes, `progress` added so the chapter toast
  can name its count) are null unless a mark happened (`moveCard` calls `markDoneWithin` in its own transaction). The move and the Done
  ring are instant as before, but for such a card the toast waits for the answer: "Nice, that's done. File marked as done too." with Undo
  (a chapter or course finish shows the reader's toast or dialog instead, through `celebrate`, with that message, then a toast per
  milestone through `showMilestones`; the dialog gives focus back to the card). Its Undo moves the card back and, only when
  `fileMarked` was true, then sends `DELETE /api/v1/completions/ID` (failure: "Couldn't mark the file as not done."); a file that was
  already done keeps "Nice, that's done." and Undo only moves the card back. A tile whose file is done shows a small success-green
  "✓ File done" before "Open ›". The board and the reader share the done state in the browser (`syncDone`).
  Drag and drop (desktop, md and up only; `todo-dnd.tsx`, `@dnd-kit`): the whole card is the drag source
  (mouse or pen; a press that moves about 6px starts a drag, so a click without movement still opens the
  card view). A press on a button or link other than the title button (the "…" menu, Start, Done, Open) never
  starts a drag. While dragging, a slightly tilted copy with a stronger shadow follows the pointer
  (`DragOverlay`), the card's own place shows a dashed slot that moves to where it will land, and the column
  under it gets a primary ring; reduced motion drops the tilt and the drop animation. Cards still being
  created cannot be dragged. A drop that changes nothing does nothing; otherwise it goes through the board's
  own `move` (queue, rollback toast, Undo and the Done celebration), with "Moved to ..." / "Nice, that's
  done." across columns and "Moved up" / "Moved down" within one. Keyboard: the title button is the handle;
  Space picks the card up, the arrow keys move it (left/right between columns, up/down within one), Space
  drops, Esc cancels (and only cancels); the focus stays on the card. On desktop Space therefore no longer
  opens the card view: Enter does (on a phone Space still opens it). While a drag is on, N does nothing, and
  the click a Space release would cause is ignored. Screen readers hear, in `@dnd-kit`'s live region,
  "Picked up TITLE. To do, position 2 of 5.", "TITLE is over In progress, position 1 of 3.", "Dropped TITLE in
  Done, position 1 of 4." and "Cancelled. TITLE went back to To do, position 2.", plus the instructions
  "To pick up a card, press Space...". Below md nothing is drag-aware (no `DndContext`, no
  `aria-roledescription="sortable"`); Start, Done and the menu remain the way to move. Filters (`board-filter.ts`, `board-filter-bar.tsx`; browser only, not saved, not in the URL): a "Filter cards" box and chips above the board (the search page's chip style): All, one per course code that a card's available file has (gone when no card has it; a selected one falls back to All) and "Notes only" (cards with no file). One chip at a time; the text (ignoring case and accents) is looked for in the shown title, the note and the course code, and must match together with the chip. Column counts and phone tab counts show the filtered number, and an empty column says "No cards match". Phone chips scroll sideways (44px). Start, Done and Move to still put the card at the top of the column; Move up / Move down and drops go past the visible neighbour (`realIndexFor` maps to the real index the server uses), and the ends are those of the filtered list. A new card the filter would hide clears the filter; the card open in the card view stays listed while edited and leaves the view when it closes (focus as after a delete).
- Admin users page (`/admin/users`; admin only, server-rendered, `noindex`, `no-store` like the other `/admin` pages; not found for a student, sign-in for a visitor): reached from "Users" in the admin bar (Resources, Courses, Lecturers, Chapters, Storage, Users). Title "Users", a count ("12 users"), a plain GET form (email box "Email", an "Unconfirmed only" and a "Blocked only" checkbox, which combine, a Search button) whose values live in the URL (`?q=…&status=unconfirmed&blocked=1&page=N`; unusable values are ignored; `params.ts`), then the list, 50 per page, newest sign-up first, with the resource list's paging. Each user shows email, name (a muted dash without one), role (Admin or Student), signed-up date (Beirut time, "29 Oct 2026"), a Confirmed (outline) or Unconfirmed (secondary) badge, a destructive "Blocked" badge beside it for a blocked user, and last active ("Never" without one). Last active is the creation time of the user's newest refresh token, any token, revoked or not (a token is rotated on every use), so there is no column for it. Desktop (md and up): a table-like grid with a header row; phone: a stacked row per user (email, name · role, "Signed up …", "Last active …", the badge at the right). Search is "contains", ignoring case, with `%`, `_` and `\` taken literally. No results: "No users match." with a link to clear. Backed by `listUsers(viewer, { q, unconfirmed, blocked, page, pageSize })` in `src/services/users` (admin only, `ForbiddenError` otherwise).
  Each user's email is a link whose box covers the whole row, to the user detail page (`/admin/users/ID?q=…&status=…&blocked=1&page=N`: the list's own params, so "‹ Users" returns to the same view; the back link is rebuilt with `usersHref` from the parsed params, never from a given address). The detail page is admin only like the list; an unknown or malformed id is the 404 page. Title: the email. Sections: Account (name or "No name", role, signed-up date, "Confirmed 29 Oct 2026" or an Unconfirmed badge, "Status": "Active" or a destructive Blocked badge with the date, last active or "Never"), Activity (saved resources, live to-do cards, completions, milestones, active days; only this user's rows, soft-deleted cards not counted), Security (open sessions: refresh tokens neither revoked nor expired; failed sign-ins for the user's email in the last 7 days, "3 in the last 7 days, latest 29 Oct 2026, 14:05" or "None in the last 7 days"). Backed by `getUserDetail(viewer, id, now?)` (admin only; `NotFoundError` for a malformed or unknown id), which shares the last-active rule with `listUsers`. An "Actions" section under Account (shown only when an action applies) holds the actions. For an unconfirmed user it has a "Confirm email" button (`confirm-email-button.tsx`, no question first): `POST /api/v1/users/ID/confirm-email` (`adminWrite`; 200 `{ emailConfirmedAt }`), then the toast "Email confirmed." and a refresh, so Account shows "Confirmed …" and the button is gone. Backed by `confirmUserEmail(viewer, id, now?)` (admin only; `NotFoundError` for a malformed or unknown id): in one transaction it sets the confirmed time only if empty (idempotent, the first time is kept) and deletes the user's unused confirmation links, so they stop working; the user can sign in at once. For a student (never an admin account) it also has "Block user" (destructive) or, when blocked, "Unblock user" (outline), `block-button.tsx`, each opening an `AlertDialog` ("Block EMAIL?" / "Unblock EMAIL?" with what happens; the dialog stays open while the request runs): `POST /api/v1/users/ID/block` / `unblock` (`adminWrite`; 200 `{ blockedAt }`, `null` for unblock; blocking an admin is 403), then the toast "User blocked." / "User unblocked." and a refresh. Backed by `blockUser(viewer, id, now?)` and `unblockUser` (admin only; `NotFoundError` for a malformed or unknown id): `blockUser` in one transaction sets `blocked_at` only if empty (the first time is kept), refuses an admin target with `ForbiddenError` and revokes every live refresh token of the user, so they are signed out everywhere; an access token already issued works until it expires (15 minutes at most, accepted). Last, for a student only (never an admin account), a "Danger zone" section at the bottom (red-tinted border card, a muted line saying what is deleted, a destructive "Delete account" button; `delete-account-button.tsx`): an `AlertDialog` "Delete EMAIL?" with a labelled box "Type the email to confirm"; its destructive "Delete account" button stays disabled until the typed value (trimmed, case-insensitive) equals the email and while the request runs; the box is cleared when the dialog closes. `DELETE /api/v1/users/ID` (`adminWrite`; 204; an admin target is 403, an unknown or malformed id 404), then the toast "Account deleted." and a return to the users list with its params. Backed by `deleteUser(viewer, id)` (admin only; `NotFoundError` for a malformed or unknown id; `ForbiddenError` for an admin target): in one transaction it removes the pending (not yet sent) `email_jobs` addressed to the user's email and deletes the user, and the database cascades saved resources, to-do cards, completions, active days, milestones, sessions and confirmation links; resources are never affected, and the address can sign up again as a new account.
- Admin courses page (`/admin/courses`; admin only, server-rendered, `noindex`, `no-store` like the other `/admin` pages; not found for a student, sign-in for a visitor): reached from "Courses" in the admin bar, whose order is Resources, Courses, Lecturers, Chapters, Storage, Users. Title "Courses", a "New course" card (Code with the hint "Letters and digits, e.g. I3301. Spaces are removed.", Title, Year (native select, one option per entry of `YEARS`) and Semester ("Semester 1" / "Semester 2"), which together post the stored 1 to 8 number (`storedSemester`; Master 1 posts 7 or 8), "Add course"), a count ("12 courses") and the courses grouped under "First year · Semester 1" … "Master 1 · Semester 2" headings (semester, then code; an empty semester says "No courses yet."). Each row: code, title, "N resources" (drafts included), "N chapters" and the actions Edit, Chapters (`/admin/chapters?course=CODE`) and View (`/courses/CODE`). Add: toast "Course added.", fields cleared, list refreshed, focus back on Code. Edit opens a `Dialog` with the same fields and the note "Changing the code changes the course's address (/courses/CODE)."; Save gives "Course saved.", closes the dialog (focus back on Edit) and refreshes. Field errors from a 400 show under each field, a 409 shows "A course with this code already exists." under Code, typed values are kept; submit buttons are disabled while the request runs and until hydrated, forms use `method="post"`. There is no delete. API through `adminWrite`: `POST /api/v1/courses` `{ code, title, semester }` (201 `{ course: { id, code, title, semester } }`) and `PATCH /api/v1/courses/ID` with any of the three (200 `{ course }`); 400 `{ error: "Invalid input", fields }`, 409 `{ error: "code_taken" }`, 404 for an unknown or malformed id, 401/403 as the other admin writes. Backed by `listAdminCourses`, `createCourse` and `updateCourse` in `src/services/courses/admin.ts` (admin only): the code is normalised by `normaliseCourseCode` (trimmed, all whitespace removed, uppercased), must then be 2 to 20 letters and digits, and is unique ignoring case (`CourseCodeTakenError`, checked before writing and also caught from the `lower(code)` unique index); a course may keep its own code in any case.
- Admin lecturers page (`/admin/lecturers`; admin only, server-rendered, `noindex`, `no-store` like the other `/admin` pages; not found for a student, sign-in for a visitor): reached from "Lecturers" in the admin bar, between Courses and Chapters. Title "Lecturers", a "New lecturer" card (Name with the hint "As students know them, e.g. Dr. Ali Ghorayeb.", "Add lecturer"), a count ("5 lecturers", "No lecturers yet." when empty) and one row per lecturer by name: name, slug (muted, monospace), "N files" (drafts included), Edit and Delete. Add: toast "Lecturer added.", field cleared, list refreshed, focus back on Name. Edit opens a `Dialog` with Name and the note "Renaming keeps the lecturer's address (?lecturer=SLUG)."; Save gives "Lecturer saved.", closes the dialog (focus back on Edit) and refreshes. A 409 shows "A lecturer with this name already exists." under Name, a 400 shows a field error, typed values are kept. Delete opens an `AlertDialog` "Delete NAME?" ("This cannot be undone."); on 204 the toast "Lecturer deleted." and a refresh; on 409 `lecturer_in_use` the dialog stays open, says "NAME is used by N files. Change or clear their lecturer first." and its Delete button is disabled. Submit buttons are disabled while the request runs and until hydrated, forms use `method="post"`. API through `adminWrite`: `POST /api/v1/lecturers` `{ name }` (201 `{ lecturer: { id, name, slug } }`), `PATCH /api/v1/lecturers/ID` `{ name }` (200 `{ lecturer }`) and `DELETE /api/v1/lecturers/ID` (204); 400 `{ error: "Invalid input", fields }`, 409 `{ error: "name_taken" }` or `{ error: "lecturer_in_use", fileCount }`, 404 for an unknown or malformed id, 401/403 as the other admin writes. Backed by `listAdminLecturers`, `createLecturer`, `updateLecturer`, `deleteLecturer` and `lecturerSlug` in `src/services/lecturers/admin.ts` (admin only): `LecturerNameTakenError` is checked before writing and also derived from a unique-index violation, `LecturerInUseError { fileCount }` from a count before the delete (and from the foreign key if a save races). A file's lecturer is set in three places, all with native selects whose first option is "None" and whose others are every lecturer by name (`listLecturerOptions` in `src/services/lecturers/admin.ts`, admin only): the new and edit resource forms ("Lecturer", under "Where does it belong?"; editing keeps, changes or clears it; the form always sends `lecturerId`, `null` for None); bulk upload ("Lecturer for the whole batch" beside Visibility, and a Lecturer select on each row: a row takes the batch value when it is added, and when the batch value changes every row the admin has not changed by hand follows it, tracked per row by `lecturerTouched`; each saved resource gets its row's value); and the admin resource list (`/admin?lecturer=SLUG`, a Lecturer select beside Course, "All lecturers" first, unknown or malformed values ignored, kept in paging links; `listResources` takes the slug as `lecturer`, and admin rows show the lecturer's name in their details). Students see it on every `ResourceRow` as a muted `text-xs` line with the name (after the title line, so after the title in exam rows that use a lead; nothing when there is none) and in the reader's details column as a "Lecturer" item under its own small heading (only when there is one). `ResourceListItem` and `ReaderResource` carry `lecturer: { slug, name } | null`, loaded in the same query as the rows (course outline, chapter pages, exams, search, Saved, reader). A draft is never visible to students, so neither is its lecturer. Seed: three fake lecturers ("Dr. Ada Example", "Dr. Alan Sample", "Pr. Grace Placeholder") on files of DEMO510 and DEMO301 only (not DEMO610 or DEMO410), seeder `demo-lecturers`.
- Admin searchable selects and the Status filter: long admin lists use `SearchableSelect` (`src/components/ui/searchable-select.tsx`, owner picked prototype variant C, 2026-11-24): a trigger that looks like a select and opens a dialog with a search box (matches anywhere in the label, ignoring case), a result count, group headings (courses by "Second year · Semester 1"), arrow keys + Enter, a "No course matches" line, and the value posted through a hidden input (same `name`, so GET and POST forms keep working; with JavaScript off it cannot open, an accepted limit on admin pages). Used for Course and Lecturer on the admin resource list, Course on the admin chapters page, and Course, Chapter and Lecturer on the resource form. Short fixed lists (type, session, academic year, semester, year, language, "Solution of") and the bulk-upload rows stay native selects. The admin resource list also has a "Status" segmented control (All, Published, Drafts; plain radios, so it works without JavaScript) in the URL as `?status=published|draft` (`params.ts`; unusable values ignored); `listResources` takes `status` and applies it for admins only (students never see drafts).
- In-page sign-in state (`/saved`, `/todo`, `/progress`; `signed-out-state.tsx`, texts in `src/lib/auth/sign-in-reason.ts`): a visitor
  with no valid access token is not redirected. The page keeps its header, navigation (no lock icons), breadcrumb and title and shows, centred
  (max-w-md), a 56px muted icon (Bookmark, ListTodo, TrendingUp), a page title ("Sign in to see your saved files" / "Sign in to use your
  to-do board" / "Sign in to see your progress"), a muted line that also says browsing and downloading never need an account, a "Sign in"
  button (to `/sign-in?next=<page>`), an outline "Create an account" (to `/sign-up`) and a "Browse courses" link. It holds no personal data and
  the pages stay `noindex` / `no-store`. A visitor whose access token expired but who still has a refresh cookie never sees it: the refresh
  cookie is scoped to `/api/v1/auth`, so a server page cannot see it; on mount the browser renews the session once (`renew`, the shared
  lock), shows a same-size skeleton meanwhile, then `announceSessionChange()` and `router.refresh()` render the real page; only a failed
  renewal shows the prompt. `/api/v1/auth/restore` is unchanged and still used by the admin pages (`requireSignedInPage`).
- Sign-in dialog for actions (`sign-in-dialog-host.tsx` mounted once in `SiteChrome`, store `src/lib/sign-in-dialog.ts`, `requestSignIn(action)`):
  a signed-out tap on Save for later (reader, menu, row bookmark), Add to to-do (reader, menu, Saved page) or Mark as done (reader, menu), and
  a 401 in the middle of such an action, open a dialog over the current page instead of leaving it. Title "Sign in to save this file" / "Sign
  in to add this file to your to-do" / "Sign in to mark this file as done", the line "You'll stay on this page, and we'll do it for you.", the sign-in
  form (the same `SignInFields` as `/sign-in`: errors, show/hide password, Caps Lock hint, unconfirmed and blocked handling), a submit button
  "Sign in and save" / "Sign in and add" / "Sign in and mark as done", "New here? Create an account" (to `/sign-up`) and "Not now". Focus is
  trapped, Esc, the backdrop and "Not now" close it and do nothing, and focus returns to the tapped control. On success the session event
  makes the browser stores ask again, the dialog closes, the page stays where it is and the tapped action is done with its usual
  optimistic update and toast (a mark never un-marks). Server components still never read the session on public pages.
- Sign-in page (`/sign-in`): a full-screen split. On desktop (md and up) a deep-blue panel (the `brand-panel` token, white text, same in both themes) with the brand name, the home headline and three feature lines sits beside the form; on a phone the panel is hidden. The account pages (in the `src/app/(auth)` route group) are full-screen pages without the site header or footer: the panel fills the left side on desktop, and the right side has a slim bar (the brand linking home on a phone, the theme toggle), the form centred, and the disclaimer under it. The form shows errors in one destructive alert, clears and focuses the password after a wrong one, has a show/hide password button and a Caps Lock hint. The account forms use `method="post"` and keep their submit button disabled until hydrated, so a native submit can never put credentials in the URL. The split is `AuthShell` in `src/components/auth`. It also shows "New here? Create an account" (to `/sign-up`) above "Back to courses" (`BackToCourses`, `src/components/auth/back-to-courses.tsx`, also on sign-up, check-email and confirm-email). When the password is right but the email is not confirmed (403 `email_not_confirmed`) it shows a default (not destructive) alert, "Confirm your email first. We sent a link to s•••@gmail.com.", with a "Send a new link" button that posts the typed address to the resend endpoint and answers "A new link is on its way." (429: "Please wait before asking for another link."); the password is kept. When the password is right but the account is blocked (403 `account_blocked`) it shows one destructive alert, "This account is blocked. If you think this is a mistake, contact the site owner." (no resend button, password kept); a wrong password gets the usual message, so the block is not revealed, and a blocked attempt is not recorded as a failed sign-in. The header still shows only "Sign in"; sign-up is reached from the sign-in page. `?next=` (a same-site path checked by `safeNextPath`) is where sign-in sends the visitor afterwards, also when already signed in (`/admin` pages send a signed-out visitor there with their own path); otherwise admins go to `/admin` and students to `/`. Sign-up does not carry it. When `?next=` is `/saved`, `/todo` or `/progress`, a muted line above the form says why ("Sign in to see your saved files", "...to use your to-do board", "...to see your progress"); any other or no target shows nothing. The form is `SignInFields` (`src/components/auth/sign-in-fields.tsx`), shared with the sign-in dialog.
- The account pages share `BrandPanel` (the panel content) and `AuthShell`; each is `noindex`, has 44px touch targets and shows errors in one destructive alert.
- Sign-up page (`/sign-up`; a signed-in visitor is redirected, like on `/sign-in`): "Create your account", fields Name (optional), Email and Password (show/hide, hint "At least 10 characters.", length also validated in the browser; no repeat field), "Create account", and a link to `/sign-in`. Field errors from a 400 show on the fields; a 429 says there were too many sign-ups from this network. On 202 the address is kept in `sessionStorage` (`signup:email`, never in the URL) and the page goes to `/sign-up/check-email`.
- Check-email page (`/sign-up/check-email`): "Check your inbox" and "We sent a confirmation link to s•••@gmail.com." (`maskEmail`: first character of the local part, •••, the full domain; with no stored address it says "your email address" and the resend control asks for it). "Send a new link" is disabled for 60 s on arrival and after each send, with a countdown; 202 says "A new link is on its way.", 429 asks to wait and disables for `retryAfterSeconds` (shown at most 120 s). "Wrong email? Start again" clears the stored address and goes to `/sign-up`.
- Confirm-email page (`/confirm-email?token=…`, `referrer: no-referrer`): the browser, not the server, reads the token, removes it from the address bar with `history.replaceState` and posts it once to `/api/v1/auth/confirm`, so mail scanners that prefetch the link cannot use it up. The link also signs the student in (owner, 2026-11-25): a successful confirm sets the session cookies (a new session, like a sign-in), the page announces the session change and shows "Email confirmed", "You're signed in. Your account is ready." and a "Start browsing" button to `/`. A blocked account is confirmed but not signed in: "Email confirmed" with a Sign in button. An expired, used, unknown or missing token: "This link can't be used", a resend form that asks for the address, and a Sign in link.
- The brand is "UniMate" (owner, 2026-11-25; domain `unimate-fs.online`, "fs" for Faculty of Science; the repository
  and this file's title keep the working name UniversityAssistant). The name appears in the page titles and
  `og:site_name` (`SITE_NAME`), the email sender name and the text of the emails. No university logo, crest or name as
  branding. Identity (owner picked option H, #207): the mark is four rounded tiles in the year colours (sky `#0EA5E9`,
  violet `#8B5CF6`, emerald `#10B981`, amber `#F59E0B`), each column tilted like one half of an open book, with no
  background of its own; the wordmark is two-tone, "Uni" in the heading colour and "Mate" in the link colour (`text-link`).
  `BrandMark` and `Wordmark` (`src/components/brand/brand-mark.tsx`) draw them; `BrandLink` (mark and wordmark, accessible
  name "UniMate", 44px tall) is the home link in the header, the phone menu and the account pages' bar. On the deep-blue
  brand panel the mark sits on a white rounded plate (`plate`) and "Mate" uses `--brand-panel-accent` (`#C9D1FF`, 4.7:1).
  Images in `src/app`: `icon.svg` (transparent), `favicon.ico` (16, 32, 48), `apple-icon.png` (180, white square),
  `opengraph-image.png` and its copy `twitter-image.png` (brand blue, plated mark, wordmark, yellow bar, one line). They are
  generated by `scripts/generate-brand-images.mjs` (instructions inside) and committed; change the mark there and in
  `brand-mark.tsx` together. No Next.js sample files remain in `public`.
- Page titles and link previews: the course tab is "CODE Title" and the chapter tab "CODE · Chapter N: Title"
  (`courseTitle`, `chapterTitle` and `pageMetadata` in `src/lib/page-title.ts`, used by `generateMetadata` on
  both pages with the light `getCourseTitle` / `getChapterTitle` queries, never the course's files; an unknown course or
  chapter, and the 404 page, are titled "Page not found"; course and chapter previews keep the site description). The root
  metadata (`src/app/layout.tsx`) sets `metadataBase` (from `getAppUrl`), Open Graph (site name, description,
  type website, locale en) and a Twitter summary card; the one generic image is `opengraph-image.png`
  (`twitter-image.png` is a copy; 1200x630, brand blue, name and one line, no claim about courses). A page with
  its own title repeats the site name through `pageMetadata`, because its `openGraph` replaces the layout's. The
  `viewport` export sets `colorScheme: "light dark"` and `themeColor` to the page backgrounds (`#f5f5f5` light,
  `#14161c` dark).
- Skip link and landmarks: `SiteChrome` starts with a "Skip to content" link (`href="#main"`, visually hidden,
  shown with a primary background and focus ring when focused). Every page's `<main>` is `id="main"` with
  `tabIndex={-1}`, `scroll-mt-20` (clears the sticky header) and no outline, so activating the link moves focus
  there. The account pages have no skip link (no header navigation to skip).
- Text is never below 12px (`text-xs`) on student pages; on the to-do columns' tints the small muted texts that
  sit directly on a tint (empty-column text, "Add a card") use the foreground token, because muted text falls
  under 4.5:1 on the in-progress and done tints in the light theme. Loading labels use the ellipsis character
  ("Signing in…"). Email inputs set `autoCapitalize="none"` and `spellCheck={false}`. A base rule gives links,
  buttons and form controls `touch-action: manipulation`, and the shared `sheet` and `dialog` contents use
  `overscroll-contain`. Hover lifts and slides (year cards) are `motion-safe:`; counts in texts agree with their
  number ("1 file"; `plural`, `noun` in `src/lib/plural.ts`, `src/lib/celebration-text.ts`).
- 404 page (`NotFoundContent`): "Page not found" with three buttons, "Back to home", "Browse courses" (`/#years`)
  and "Search" (`/search`). The footer says: "Independent student project. Not an official Lebanese
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
