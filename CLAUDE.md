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
  approved its use. Until then, use seed/sample data.
- Seed data is placeholder during development: obviously fake course codes,
  titles and resources. The real course list and files are loaded in a
  separate data-gathering phase; do not ask for them or invent real-looking
  ones before then. The seeded demo student has a few completions (DEMO610: chapter 1 finished, two files of chapter 2,
  one exam; DEMO410: one lecture) and active days (today and up to two earlier days of the current Beirut week) so demos show progress; e2e specs that mark files must not use those courses.
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
  General), published flag, and the text check of its file: `page_count` and `text_page_count` (both null
  when not checked). A page has text with at least 30 non-whitespace characters (PDF.js); no text page is
  Scanned, some is Partly scanned, derived and never stored. The admin's browser checks at upload and sends it
  with the file ticket; a replaced file without a check resets both to null. Admin-only badge and filter; it
  never blocks saving or publishing. `npm run text-layers:check` backfills stored files.
- Chapter: belongs to one course; position unique within the course; title.
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
  `SiteChrome` at the top centre so a toast never covers the phone tab bar or the reader's floating bar.
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
  - Success green (`--success` / `--success-foreground`: `#166534` on white text in light, `#4ADE80`
    on `#0B1A10` text in dark; 7.1:1 and 10.3:1): for Done on the to-do board (column bar,
    check marks, Done button) and for Done / finished progress (the reader Done button, row checks,
    finished chapters and courses). Not a general positive colour; progress in flight uses the primary.
  - Light theme: headings `#41454F`, body text `#575757`, page `#F5F5F5`, muted `#F8F8F8`,
    cards white. The dark theme uses dark neutral surfaces with light text.
  - Text contrast is at least 4.5:1 in both themes.
- Theme: light and dark, defaults to the device setting, toggle in the top bar.
- UI language: English only.
- Navigation adapts to the device. The items are Browse, Exams, Search, Saved, To-do and Progress, shown to
  everyone (signed out, Saved, To-do and Progress lead through sign-in and back; the bar never waits for the
  session). Phone: slim top bar (brand, theme toggle, account) plus a fixed bottom tab bar with the six
  items (Progress after To-do; owner decision 2026-10-28), the current one with its icon on a tinted pill. Desktop (md and up): the same items inline in the
  top bar (six, Progress after To-do), Saved, To-do and Progress after a thin divider, the current item underlined in primary along the bar's
  bottom edge (icons from lg up), and a breadcrumb trail on inner pages. An item without a page would be shown disabled. The account pages (sign-in, sign-up, check-email, confirm-email) are the exception: see the Sign-in page bullet. The top bar
  also shows a "Sign in" link or, when signed in, a round avatar with the user's initials (a person icon
  without a name), labelled with the name (never the email). Its menu holds the account only: the name,
  Admin (admins only) and Sign out; pages never go in it.
- Home is a landing page: a hero (headline, description, "Browse courses" and "Previous exams"
  buttons, three facts, and a decorative course preview), a numbers strip (only from 5 courses), the
  semester cards (an empty semester is a muted card, not a link), how it works, what you will find,
  an "Exams coming up?" band with a link per session, and four questions. Only the strip and the
  cards read the database. For a signed-in student a "Your progress" band (`ProgressBand`, `data-personal`)
  follows the hero: loaded by the browser from `GET /api/v1/progress` after the page shows (Home stays static;
  a visitor gets no band and no request), "N active days this week", up to three of My courses by latest
  completion (ring, code, title, "x of y files · P%" or "✓ Finished", or "Exams: x of y done" for an
  exams-only course) and "See all ›" to `/progress`; with no My courses it says "Mark files as done in the
  reader to track your progress here." and leaves "See all" out. No claims about features that do not exist.
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
  on a phone) has Fit width, Fit page, Focus mode, then Save for later (or Remove from saved when it
  is saved), Add to to-do, Mark as done (or Mark as not done; only for a lecture, notes, exercise or
  exam), Download and Open outside the reader. Focus mode
  makes the card cover the whole viewport (and asks for real fullscreen where available, but does
  not depend on it); Esc leaves it (or closes an open search first). Keys (when not typing): arrows,
  PageUp/PageDown, Home/End, `+`/`-`, `0`. The page being read is remembered per resource in
  `localStorage` (`reader:last-page:ID`), and a later visit offers "Continue where you left off,
  page N?" once; this is a position only, never progress. Desktop (md and up): breadcrumb ending at
  the course area that lists the resource, the title with its type and language on one line, the
  card at a fixed height with the pages scrolling inside it, and a narrow details column (plain text
  under small headings) beside it, with a full-width "Save for later" button at its top that becomes
  "Saved" (filled bookmark) once saved; pressing "Saved" removes it. Under it an outline "Add to to-do" button
  makes a card in To do linked to this file (toast "Added to To do" with "View board"; the same file may be
  added again; signed out it goes to sign-in like Save). Under it, for a lecture, notes, exercise or exam
  only, an outline "Mark as done" button becomes a filled success-green "Done" (check icon,
  `aria-pressed`) once marked; pressing "Done" un-marks it. Like Save it is optimistic, shares one browser
  store with the menu item (`src/lib/completions-client.ts`, `GET /api/v1/completions/ids` once per page
  load, only for a signed-in viewer), rolls back with a toast on failure, and signed out goes to
  `/sign-in?next=` with nothing marked afterwards. Toasts, both with Undo: "Marked as done. Chapter 2: 4 of
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
  controls show and using one goes to `/sign-in?next=<this page>`; there is no automatic save after
  signing in. There is no AI panel yet and no text about one.
- Saved page (`/saved`): private, server-rendered, `noindex` and `no-store` (header set in
  `next.config.ts`), reached from "Saved" in the main navigation (also in the phone tab bar).
  `requireSignedInPage` (`src/lib/auth/page-guard.ts`, also the base of the admin guard) sends a
  visitor with no valid access token through `/api/v1/auth/restore?next=/saved`, which renews the
  session or goes to `/sign-in?next=/saved`. Saved files are grouped by course (semester, then
  course code; "DEMO301 Title" with the semester muted), newest save first inside a course, published
  files only (a withdrawn file simply disappears). Each item is the shared resource row (opens the
  reader in the same tab, solutions below) with its filled bookmark icon (see "Save bookmark on rows") and
  an "Add to to-do" icon beside it (`ListPlus`, label "Add TITLE to to-do", same action as in the reader). The icon
  removes the item: it leaves the page at once, with the toast "Removed from saved." and no reload,
  and a course with nothing left disappears. Empty state: a bookmark icon, "Nothing saved yet. Tap
  the bookmark on any file to keep it here." and a "Browse courses" button. `GET /api/v1/saved` returns the same
  groups.
- Progress page (`/progress`): private like `/saved` (server-rendered, `noindex`, `no-store`, `requireSignedInPage` with
  `next=/progress`), reached from "Progress" in the main navigation, after To-do, on phone and desktop (the course
  page's progress block also links to it). Breadcrumb Home › Progress, title "Your progress" with "Based only on the
  files you marked as done.", then My courses (courses with at least one completion of a published file) grouped
  under "Semester N" headings, semester then code, in a 2-column grid from md up. Each card: a ring (64px, 56px on a
  phone; a finished course is a full green ring with a check), the linked "CODE Title", and "8 of 13 files · Exams: 2 of
  6 done" ("Finished" in success green first when done; no exams part without exams; on a phone the exams part is on
  its own line); then one row per chapter with counted files, in position order, and "General" when it has counted
  files: "N · Title", a 6px bar (primary, green when finished) and "4/5" or "✓ 3/3". A finished course has a
  green-tinted border. Success green only means finished. The ring container is labelled "62% done, 8 of 13 files";
  bars are `aria-hidden`. Empty: "Nothing marked as done yet. Open a file and press Mark as done to see your progress
  here." and "Browse courses". Backed by `getProgressOverview` (`src/services/progress`; one grouped count over all My
  courses, sharing its counting with `getCourseProgress`) and `GET /api/v1/progress` (`{ courses: [{ code, title,
  semester, lastCompletedAt, course, exams, chapters, general }] }`). Semester pages (`/semesters/N`) show a small ring
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
  Signed out it goes to `/sign-in?next=` the current path and query (nothing is saved). The pages stay
  static: the browser asks `GET /api/v1/saved/ids` once per page load (never for a visitor) and all
  icons share the answer; toasts are the reader's. The row's `action` slot is for extra controls
  beside the bookmark.
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
  `requireSignedInPage` / restore / `/sign-in?next=%2Ftodo` path), reached from "To-do" in the main
  navigation (also in the phone tab bar). Look follows prototype variant D. Desktop (md and up): breadcrumb
  Home › To-do, a "New card" button (shortcut N, only when focus is not in a field and no modifier is
  held) and three tinted columns side by side, each with a coloured top bar, icon, label and count, and
  a friendly empty text; "Add a card" at the bottom of each column opens a
  small form with one title field: Enter adds the card and keeps the form open, an empty title does
  nothing, Esc or Cancel closes it and returns focus to "Add a card". Phone: three tabs (icon, label,
  count, coloured underline) show one column at a time, and a round 56px `+` button above the bottom
  tab bar (safe-area aware) opens the form of the tab shown. A card has the note icon, the title, a
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
- Admin users page (`/admin/users`; admin only, server-rendered, `noindex`, `no-store` like the other `/admin` pages; not found for a student, sign-in for a visitor): reached from "Users" in the admin bar (Resources, Chapters, Storage, Users). Title "Users", a count ("12 users"), a plain GET form (email box "Email", a "Status" select with All, Unconfirmed and Blocked, a Search button) whose values live in the URL (`?q=…&status=unconfirmed|blocked&page=N`; unusable values are ignored; `params.ts`), then the list, 50 per page, newest sign-up first, with the resource list's paging. Each user shows email, name (a muted dash without one), role (Admin or Student), signed-up date (Beirut time, "29 Oct 2026"), a Confirmed (outline) or Unconfirmed (secondary) badge, a destructive "Blocked" badge beside it for a blocked user, and last active ("Never" without one). Last active is the creation time of the user's newest refresh token, any token, revoked or not (a token is rotated on every use), so there is no column for it. Desktop (md and up): a table-like grid with a header row; phone: a stacked row per user (email, name · role, "Signed up …", "Last active …", the badge at the right). Search is "contains", ignoring case, with `%`, `_` and `\` taken literally. No results: "No users match." with a link to clear. Backed by `listUsers(viewer, { q, unconfirmed, blocked, page, pageSize })` in `src/services/users` (admin only, `ForbiddenError` otherwise).
  Each user's email is a link whose box covers the whole row, to the user detail page (`/admin/users/ID?q=…&status=…&page=N`: the list's own params, so "‹ Users" returns to the same view; the back link is rebuilt with `usersHref` from the parsed params, never from a given address). The detail page is admin only like the list; an unknown or malformed id is the 404 page. Title: the email. Sections: Account (name or "No name", role, signed-up date, "Confirmed 29 Oct 2026" or an Unconfirmed badge, "Status": "Active" or a destructive Blocked badge with the date, last active or "Never"), Activity (saved resources, live to-do cards, completions, milestones, active days; only this user's rows, soft-deleted cards not counted), Security (open sessions: refresh tokens neither revoked nor expired; failed sign-ins for the user's email in the last 7 days, "3 in the last 7 days, latest 29 Oct 2026, 14:05" or "None in the last 7 days"). Backed by `getUserDetail(viewer, id, now?)` (admin only; `NotFoundError` for a malformed or unknown id), which shares the last-active rule with `listUsers`. An "Actions" section under Account (shown only when an action applies) holds the actions (delete is a later ticket). For an unconfirmed user it has a "Confirm email" button (`confirm-email-button.tsx`, no question first): `POST /api/v1/users/ID/confirm-email` (`adminWrite`; 200 `{ emailConfirmedAt }`), then the toast "Email confirmed." and a refresh, so Account shows "Confirmed …" and the button is gone. For a student (never an admin account) it also has "Block user" (destructive) or, when blocked, "Unblock user" (outline), `block-button.tsx`, each opening an `AlertDialog` ("Block EMAIL?" / "Unblock EMAIL?" with what happens; the dialog stays open while the request runs): `POST /api/v1/users/ID/block` / `unblock` (`adminWrite`; 200 `{ blockedAt }`, `null` for unblock; blocking an admin is 403), then the toast "User blocked." / "User unblocked." and a refresh. Backed by `blockUser(viewer, id, now?)` and `unblockUser` (admin only; `NotFoundError` for a malformed or unknown id): `blockUser` in one transaction sets `blocked_at` only if empty (the first time is kept), refuses an admin target with `ForbiddenError` and revokes every live refresh token of the user, so they are signed out everywhere; an access token already issued works until it expires (15 minutes at most, accepted). Backed by `confirmUserEmail(viewer, id, now?)` (admin only; `NotFoundError` for a malformed or unknown id): in one transaction it sets the confirmed time only if empty (idempotent, the first time is kept) and deletes the user's unused confirmation links, so they stop working; the user can sign in at once.
- Sign-in page (`/sign-in`): a full-screen split. On desktop (md and up) a deep-blue panel (the `brand-panel` token, white text, same in both themes) with the brand name, the home headline and three feature lines sits beside the form; on a phone the panel is hidden. The account pages (in the `src/app/(auth)` route group) are full-screen pages without the site header, footer or tab bar: the panel fills the left side on desktop, and the right side has a slim bar (the brand linking home on a phone, the theme toggle), the form centred, and the disclaimer under it. The form shows errors in one destructive alert, clears and focuses the password after a wrong one, has a show/hide password button and a Caps Lock hint. The account forms use `method="post"` and keep their submit button disabled until hydrated, so a native submit can never put credentials in the URL. The split is `AuthShell` in `src/components/auth`. It also shows "New here? Create an account" (to `/sign-up`) above "Back to courses". When the password is right but the email is not confirmed (403 `email_not_confirmed`) it shows a default (not destructive) alert, "Confirm your email first. We sent a link to s•••@gmail.com.", with a "Send a new link" button that posts the typed address to the resend endpoint and answers "A new link is on its way." (429: "Please wait before asking for another link."); the password is kept. When the password is right but the account is blocked (403 `account_blocked`) it shows one destructive alert, "This account is blocked. If you think this is a mistake, contact the site owner." (no resend button, password kept); a wrong password gets the usual message, so the block is not revealed, and a blocked attempt is not recorded as a failed sign-in. The header still shows only "Sign in"; sign-up is reached from the sign-in page. `?next=` (a same-site path checked by `safeNextPath`) is where sign-in sends the visitor afterwards, also when already signed in (`/admin` pages send a signed-out visitor there with their own path); otherwise admins go to `/admin` and students to `/`. Sign-up does not carry it.
- The account pages share `BrandPanel` (the panel content) and `AuthShell`; each is `noindex`, has 44px touch targets and shows errors in one destructive alert.
- Sign-up page (`/sign-up`; a signed-in visitor is redirected, like on `/sign-in`): "Create your account", fields Name (optional), Email and Password (show/hide, hint "At least 10 characters.", length also validated in the browser; no repeat field), "Create account", and a link to `/sign-in`. Field errors from a 400 show on the fields; a 429 says there were too many sign-ups from this network. On 202 the address is kept in `sessionStorage` (`signup:email`, never in the URL) and the page goes to `/sign-up/check-email`.
- Check-email page (`/sign-up/check-email`): "Check your inbox" and "We sent a confirmation link to s•••@gmail.com." (`maskEmail`: first character of the local part, •••, the full domain; with no stored address it says "your email address" and the resend control asks for it). "Send a new link" is disabled for 60 s on arrival and after each send, with a countdown; 202 says "A new link is on its way.", 429 asks to wait and disables for `retryAfterSeconds` (shown at most 120 s). "Wrong email? Start again" clears the stored address and goes to `/sign-up`.
- Confirm-email page (`/confirm-email?token=…`, `referrer: no-referrer`): the browser, not the server, reads the token, removes it from the address bar with `history.replaceState` and posts it once to `/api/v1/auth/confirm`, so mail scanners that prefetch the link cannot use it up. Success: "Email confirmed" and a Sign in button. An expired, used, unknown or missing token: "This link can't be used", a resend form that asks for the address, and a Sign in link.
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
