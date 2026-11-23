Spec for covering all three years of the Computer Science programme (semesters 1 to 6) and browsing
by year instead of by semester. Decisions come from a grilling session (two rounds, 13 decisions,
2026-11-18) and a UI prototype (variants on the throwaway branch `proto/years-ui`; the owner picked
the year page of variant A and the Home card of variant F, "course code chips", 2026-11-18). Terms
follow `GLOSSARY.md` (**Year** is new).

> **Amended 2026-11-22 (owner).** Students never see a semester number from 1 to 6 : inside a
> year the semesters are "Semester 1" and "Semester 2" (the stored number stays 1–6, 1–8 with Master 1; its place in
> the year is derived). Where both are shown: "Second year · Semester 1". Year page anchors are
> `#semester-1` / `#semester-2`. The admin course form and the Exams filter choose a year and a
> semester of that year (ticket 3). A fourth year, **Master 1** ("Master 1", `/years/m1`, stored
> semesters 7 and 8), was added in ticket #154 (migration widening the check to 1–8, `Year` 4, `yearBadge`); ticket 2 must not assume exactly
> three years.

## Problem Statement

The platform only covers semesters 3 to 6. First-year students (semesters 1 and 2) find nothing for
them, and their material is ready to load (the "1st year" Drive folder holds `sem-1` and `sem-2`).
The admin cannot even create a semester 1 or 2 course: the database and the forms refuse anything
outside 3 to 6. Students also do not think in semesters: they say "I'm in second year". With six
semesters, Home would show six cards with little to tell them apart, and a student has to know
which semester a course belongs to before finding it.

## Solution

Semesters 1 and 2 become valid, so the admin can create first-year courses and load their material.
Students browse by **year**: Home's "Choose your year" shows three cards (First year, Second year,
Third year), each with its number, the codes of its first courses and its course and file counts.
A card opens the year page (`/years/1`, `/years/2`, `/years/3`), which lists the year's courses
under two headings, one per semester. Old semester addresses redirect to the right section of the
year page, so shared links and bookmarks keep working. Everywhere the site names where a course
belongs (breadcrumbs, search results, Saved, Progress, the Exams filter), it says the year, with the
semester kept as a detail. The admin pages stay semester-based.

The work ships in three tickets so first-year content can be loaded early:
1. **Allow semesters 1 and 2** (database, admin, validation, seed). After it merges, first-year
   content can be loaded; until the year UI ships, those courses are reached at `/semesters/1` and
   `/semesters/2`.
2. **Year pages and Home** (year pages, redirects, Home cards and wording, breadcrumbs, nav).
3. **Year labels elsewhere** (Exams filter grouping, Search, Progress, Saved).

## User Stories

Students (signed in or not):

1. As a first-year student, I want my courses on the platform, so that I can study from it like the
   older years do.
2. As a student, I want Home to offer my year (First, Second, Third year) rather than a semester
   number, so that I pick where I am the way I describe it.
3. As a student, I want each year card to show a few course codes, so that I recognise my year at a
   glance.
4. As a student, I want each year card to show how many courses and files the year has, so that I
   know there is material behind it.
5. As a student, I want a year with no courses yet to look muted and not be a link, so that I do not
   tap into an empty page.
6. As a student, I want the year page to list the year's courses under "Semester 1" and "Semester 2"
   headings, so that I still see which semester a course is taught in.
7. As a student, I want a semester with no courses yet to say "No courses yet." on the year page, so
   that an empty section is not confusing.
8. As a student, I want the year page's course cards to look and behave like today's semester page
   cards, so that nothing new needs learning.
9. As a signed-in student, I want my progress ring on each started course of the year page, so that
   I keep the overview I had on the semester page.
10. As a student, I want an old link to a semester page to bring me to that semester's section of
    the right year page, so that bookmarks and shared links still work.
11. As a student, I want "Browse" in the navigation to be marked as current on year pages, so that I
    know where I am.
12. As a student, I want the course page breadcrumb to go Home › Second year › course, so that going
    up leads me to my year, at my semester's section.
13. As a student, I want the chapter page and the reader breadcrumbs to follow the same rule, so that
    the trail is consistent.
14. As a student, I want Home's texts (hero, "How it works", the questions) to say the platform
    covers all three years, so that first-year students know it is for them too.
15. As a student, I want "Browse courses" links anywhere on the site to land on the year cards, so
    that they still lead somewhere useful.
16. As a student on the Exams page, I want the Semester filter's options grouped by year, so that I
    find my semester quickly, and I want my shared filter links to keep working.
17. As a student on Search, I want "Or browse a year" with three links when I have not typed enough,
    so that I can browse instead.
18. As a student on Search, I want a course result to say "Second year · Semester 1", so that I know
    where it belongs.
19. As a signed-in student on Progress, I want My courses grouped under year headings with the
    semester shown on each course, so that the page matches how I browse.
20. As a signed-in student on Saved, I want each course group to say "Second year · Semester 1", so
    that it matches the rest of the site.
21. As a phone user, I want the year cards stacked one under another and easy to tap, so that the
    page works on a small screen.
22. As a visitor on a slow connection, I want Home and the year pages to stay fast and mostly static,
    so that nothing extra loads because of this change.

Admin:

23. As the admin, I want to create and edit courses in semesters 1 to 6, so that I can load
    first-year material.
24. As the admin, I want the Semester choice to say which year each semester belongs to ("Semester 1
    (First year)"), so that I do not get it wrong.
25. As the admin, I want the courses page grouped by semester from 1 to 6, so that I keep working
    with the stored fact.
26. As the admin, I want the resource list's semester filter to accept semesters 1 and 2, so that I
    can find first-year files.
27. As the admin, I want rolling the database change back to refuse while semester 1 or 2 courses
    exist, so that no data is silently broken.

Developer:

28. As the developer, I want obviously fake semester 1 and 2 courses in the demo seed, so that the
    First year is not empty in development and tests.
29. As the developer, I want one helper to turn a semester into its year and its wording, so that the
    rule and the labels never drift between pages.

## Implementation Decisions

Scope and model:
- Semesters 1 to 6 are in scope (owner decision, 2026-11-18). CLAUDE.md's Product section and
  Domain model are updated to say so.
- **Course** keeps `semester` as the stored fact; its allowed range becomes 1 to 6. The **year** is
  never stored: it is always derived, semesters 1–2 are the first year, 3–4 the second, 5–6 the
  third. There is no Year entity, table or column.
- One migration (Sequelize API, `up` in a transaction) replaces the course semester check 3–6 with
  1–6. Its `down` puts the 3–6 check back, and fails if a semester 1 or 2 course exists; that is
  correct.
- The shared bounds (semester minimum and maximum) move to 1 and 6. Everything that validates a
  semester follows them: the course create and update schemas, the semester schema used by course
  lookups, the admin resource list filter and the Exams page parameters.
- One small pure module for the year rule: semester → year, a year's two semesters, the year's
  wording ("First year", "Second year", "Third year") and the valid years (1 to 3). Every page uses
  it; no page writes the wording itself.

Wording:
- A year is always written "First year", "Second year", "Third year" (and later "Master 1"). A
  semester is written in full and numbered within its year, "Semester 1" or "Semester 2". Where both
  are shown: "Second year · Semester 1". Never "Year 2", "L2", "S3" or a semester number above 2 in
  student-facing text.
- "Academic year" (2024-2025, exams) is unchanged and keeps its own label.

Home (ticket 2):
- The section "Choose your semester" becomes "Choose your year" (anchor `#years`; every "Browse
  courses" link that pointed at `#semesters` points at `#years`, and the skeleton keeps the same id).
- Three cards, one per year, in a 3-column grid from md up, stacked on a phone. Each card (from
  prototype variant F) is a link to the year page: a filled primary circle with the year number,
  the year's name, then up to four course codes as small chips (monospace, muted background, link
  colour; in semester then code order) and "+N more" when there are more, then at the bottom
  "7 courses · 101 files" (muted) and "Browse →" (link colour). On hover the card lifts slightly and
  its border turns primary. A year with no course is a muted dashed card, not a link, saying "No
  courses yet".
- The home stats service returns one entry per year (1 to 3, empty years included) instead of one per
  semester: the year, its course count, its visible-resource count and its course codes (semester,
  then code). It still runs a fixed number of queries whatever the amount of data. The numbers strip
  is unchanged. A pure function gives the card's wording (as the semester card's does today) so the
  empty case is unit-tested.
- Home texts: the hero line, "How it works" ("Pick your year", the three years of the programme) and
  the FAQ answer (all three years, Faculty of Science, Hadath branch; no more "Semesters 1 and 2 are
  not covered") describe all three years. No claim about features that do not exist.

Year page (ticket 2):
- `/years/1`, `/years/2`, `/years/3`, prerendered; anything else is the 404 page. Breadcrumb Home ›
  Second year, title "Second year" (with the usual yellow bar), then one section per semester with a
  plain "Semester 1" / "Semester 2" heading (id `semester-1` / `semester-2`, scroll margin so a jump does not hide it under the
  bar), and the course cards exactly as on today's semester page (code, title, resource count,
  chevron, the signed-in progress ring loaded from the one `/api/v1/progress` request). A semester
  with no course says "No courses yet.". No intro line, no counts beside the headings (owner: keep it
  clean).
- A course service returns a year's courses grouped by semester (both semesters always present, in
  order, each with its courses in code order and their visible-resource counts), in a fixed number of
  queries. The year page reads it; the page still never reads the session.
- `/semesters/N` for N from 1 to 6 redirects permanently to `/years/Y#semester-K` (K = 1 for an odd N, 2 for an even one). Other values are
  the 404 page. The semester page itself is removed.
- The Browse navigation item is active on `/years/…` (and still on Home and course pages).
- Breadcrumbs on the course page, the chapter page and the reader go through the year: Home › Second
  year › …, the year crumb linking to `/years/2#semester-1`.

Year labels elsewhere (ticket 3):
- Exams: the Semester filter stays (`?semester=N`, shared links keep working); its options are
  grouped by year (native option groups "First year", "Second year", "Third year"), still only
  semesters that have a visible exam. The Course dropdown keeps its semester groups.
- Search: under 2 characters, "Or browse a year" with three links to the year pages; a course result
  says "Second year · Semester 1" before its chapter and file counts.
- Progress: My courses are grouped under year headings ("Second year"), year then semester then code;
  each course card shows its semester muted ("Semester 1"). The progress API is unchanged (it already
  carries each course's semester).
- Saved: each course group's muted line says "Second year · Semester 1". The saved API is unchanged.

Admin (ticket 1):
- The admin course form's Semester select offers 1 to 6 labelled "Semester 1 (First year)" …
  "Semester 6 (Third year)". The courses page groups by "Semester N" for 1 to 6 (an empty semester
  says "No courses yet."). The admin resource list's semester filter accepts 1 to 6. No year
  grouping on admin pages. *(Superseded 2026-11-22, ticket 3: the form has a Year select and a
  "Semester 1" / "Semester 2" select that together post the stored number, and the courses page
  headings read "Second year · Semester 1".)*

Seed (ticket 1):
- A new development-only seeder (runs only with `SEED_DEMO_DATA=true`, after the demo courses seeder,
  with a working `down`) adds one obviously fake semester 1 course and one semester 2 course with a
  few published files each (stored in the local driver like the other demo files). The demo student
  has no completions or bookmarks on them; existing demo progress (DEMO610, DEMO410) is untouched.

Content:
- Loading the real first-year material is not part of any ticket: it is done through the admin pages
  from `~/Computer Science Resources` (a `Sem 1` and a `Sem 2` folder, as for the other semesters),
  after ticket 1 merges.

## Testing Decisions

- Good tests check behaviour a caller can see (what a service returns, what a page shows, where a link
  leads), never how it is built. Tests are never weakened to pass.
- Course services, against the test database like today's course and home tests: creating and editing
  a course accepts semesters 1 to 6 and refuses 0 and 7 with a field error; the database itself
  refuses a semester outside 1 to 6; the home stats return three year entries in order with the right
  course and file counts and course codes, an empty year included, drafts not counted; the year lookup
  returns both semesters in order with their courses, an empty semester included, and refuses an
  unusable year.
- The year helper: semester to year for 1 to 6, the two semesters of each year, the wording, and the
  card wording (including an empty year) as pure unit tests, like today's semester card tests.
- Exams parameters accept semesters 1 and 2 (existing params tests extended).
- Playwright, on a fresh seeded database with local storage: Home shows three year cards; a card leads
  to its year page, which shows both semester headings and a course leads to its course page; the
  course page breadcrumb leads back to the year page; `/semesters/3` ends on `/years/2` at the
  semester 3 section; `/years/4` is the 404 page. Existing specs that visit semester pages
  (browse, home, search, progress page) are updated to the new pages and wording. The admin courses
  spec covers creating a semester 1 course.
- Prior art: the course and home service tests, the semester card unit tests, the exams params tests,
  and the browse, home and admin courses Playwright specs.

## Out of Scope

- Loading the real first-year content (a separate data task after ticket 1).
- Any Year, Major or Faculty entity, table or column.
- A year filter on the Exams page or Search (the semester filter stays).
- Year grouping on admin pages (beyond the year + semester wording added by the 2026-11-22 amendment).
- Changing what a course page, chapter page or the reader show beyond their breadcrumbs.
- Other majors, and semesters beyond 6.

## Further Notes

- Target: before partial exams (early December 2026). Ticket 1 is small and unblocks loading
  content; tickets 2 and 3 can follow while the content is being loaded.
- The prototype (all variants, including the rejected ones) stays on `proto/years-ui` and is never
  merged.
- The redirect keeps old `/semesters/N` links alive; a link to `/#semesters` simply lands on Home.
