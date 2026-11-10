Spec for filtering course material by lecturer. Decisions come from a grilling session (three
rounds, all 17 recommendations accepted, 2026-11-09) and a mockup on the course page (variants on a
throwaway branch `prototype/lecturer-filter`; the owner picked variant C, "lecturer cards",
2026-11-10). Terms follow `GLOSSARY.md` (**Lecturer** is new).

## Problem Statement

A course often has material from more than one lecturer. Server Side Development (I3302) has this
year's slides by one lecturer, a complete older course by another, and previous exams set by three
or four different lecturers over the years. Today the only way a student can tell them apart is a
"(Dr. …)" note the admin types into each title. A student who wants "only my lecturer's slides", or
"every exam this lecturer has set", has to read every row. The admin also has no consistent way to
record who a file is from: the same person ends up written three ways.

## Solution

Each resource can name its **lecturer**, chosen from a short list the admin keeps. On a course page,
when the course's published files come from two or more lecturers, a "Taught by" strip of lecturer
cards appears above the course areas: "All lecturers" first, then one card per lecturer with their
initials, name and how many files they have in the course. Choosing a card narrows every list on the
page (chapters, previous exams, other material) to that lecturer's files; the choice lives in the
address so it can be shared, Back works, and it follows the student into a chapter page. The Exams
page gets a Lecturer dropdown beside its other filters, Search finds files by lecturer name, and
every resource row and the reader show the lecturer's name. The admin gets a Lecturers page and a
Lecturer choice on every resource form, including bulk upload.

## User Stories

Students (signed in or not):

1. As a student, I want to see which lecturer each file is from, so that I know whose slides or exam I am opening.
2. As a student, I want a "Taught by" strip on a course page listing the course's lecturers, so that I can see at a glance who has material in this course.
3. As a student, I want each lecturer card to show how many files that lecturer has in the course, so that I know where most of the material comes from.
4. As a student, I want an "All lecturers" card that is selected by default, so that I see everything unless I choose otherwise.
5. As a student, I want to choose a lecturer card and see only that lecturer's files, so that I can study from my own lecturer's material.
6. As a student, I want chapters that have none of the chosen lecturer's files to disappear from the chapter cards, so that I am not sent into empty chapters.
7. As a student, I want the chapter cards to describe only the chosen lecturer's files while a lecturer is chosen, so that "what's inside" matches what I will see.
8. As a student, I want the Previous exams area to list only the chosen lecturer's exams, so that I can practise with the exams my lecturer sets.
9. As a student, I want the Other material area (and the type tabs of a course without chapters) to follow the same choice, so that the whole course page agrees.
10. As a student, I want a line saying "Showing files by Dr. X only" with a "Show all" link while a lecturer is chosen, so that I never forget the list is filtered.
11. As a student, I want the chosen lecturer to be in the address, so that I can share the filtered view with a classmate and Back returns to it.
12. As a student, I want switching between Chapters, Previous exams and Other material to keep my chosen lecturer, so that I do not have to choose again.
13. As a student, I want opening a chapter from a filtered course page to keep the lecturer, so that the chapter page shows only that lecturer's files too.
14. As a student, I want the same lecturer cards on a chapter page, counted for that chapter, so that I can change or clear the choice there.
15. As a student, I want Previous / Next chapter links on a chapter page to keep my chosen lecturer, so that I can walk the course in one lecturer's material.
16. As a student, I want a clear message on a chapter page when the chosen lecturer has nothing in that chapter, with a way to show all, so that I am not left on an empty page.
17. As a student, I want no lecturer strip on a course where all files share one lecturer or none is known, so that the page stays simple.
18. As a student, I want the strip to scroll sideways on my phone, so that it never pushes the course content far down.
19. As a student, I want an old or mistyped lecturer in a link to be ignored rather than show an error, so that shared links never break the page.
20. As a student, I want a link shared before the lecturer was renamed to still work, so that old links keep filtering.
21. As a student, I want my course progress, the chapter progress text and the progress ring to stay about the whole course, so that a filter never makes my progress look different.
22. As a student, I want a Lecturer dropdown on the Exams page, so that I can find every exam a lecturer has set across all courses.
23. As a student, I want the Exams page Lecturer dropdown to offer only lecturers who have a visible exam, so that I never pick an option that gives nothing.
24. As a student, I want the Lecturer filter on the Exams page to work without JavaScript and combine with semester, course, year and session, so that it behaves like the other filters.
25. As a student, I want typing a lecturer's name in Search to find their files, so that "ghorayeb" brings up that lecturer's material.
26. As a student, I want the reader's details column to show the lecturer, so that I know whose file I am reading.
27. As a student, I want files with no lecturer to show no lecturer line at all, so that I do not see "Unknown" everywhere.
28. As a student, I want files with no lecturer to stay visible under "All lecturers", so that nothing is hidden just because its lecturer is not known.
29. As a student, I want a draft file never to reveal a lecturer's name or count, so that what I see matches what is published.
30. As a keyboard or screen-reader user, I want the lecturer cards to be links in a labelled list, with the selected one announced as current, so that I can use and understand the filter without a mouse.

Admin:

31. As the admin, I want a Lecturers page in the admin bar, so that I can keep the list of lecturers in one place.
32. As the admin, I want to add a lecturer by name, so that I can start tagging their files.
33. As the admin, I want adding a name that already exists (ignoring case) to be refused, so that the same person is never listed twice.
34. As the admin, I want to rename a lecturer, so that I can fix a typo or add "Dr." everywhere at once.
35. As the admin, I want renaming to keep the lecturer's address name (slug), so that links students already shared keep working.
36. As the admin, I want to see how many files each lecturer has, drafts included, so that I know who is used.
37. As the admin, I want to delete a lecturer only when no file uses them, and to be told how many files do otherwise, so that I never orphan files by mistake.
38. As the admin, I want a Lecturer dropdown on the new and edit resource forms, with "None", so that I can set or clear a file's lecturer.
39. As the admin, I want a "Lecturer for the whole batch" choice at the top of bulk upload, so that a batch of one lecturer's files needs one click.
40. As the admin, I want each bulk-upload row to have its own Lecturer dropdown that starts from the batch choice, so that I can fix the odd file from someone else.
41. As the admin, I want to filter the admin resource list by lecturer, so that I can check and fix one lecturer's files.
42. As the admin, I want the lecturer to be checked on the server on every write, so that a stale or invented lecturer id is refused with a clear field error.

## Implementation Decisions

Domain and schema:

- New term **Lecturer** (in `GLOSSARY.md`): the person who taught or wrote a resource, named as
  written, e.g. "Dr. Ali Ghorayeb". In the interface it is always "Lecturer", never "doctor".
- New table `lecturers` (one migration, Sequelize API, `up` in a transaction, working `down`): `id`
  UUID (`gen_random_uuid()`), `name` (trimmed, 1 to 100 characters, unique ignoring case through a
  `lower(name)` unique index), `slug` (unique, set once at creation, never changed by a rename),
  `created_at`, `updated_at`.
- Second migration: `resources.lecturer_id` UUID, nullable, foreign key to `lecturers` with
  `ON DELETE RESTRICT`, indexed. A resource has zero or one lecturer, for every resource type.
- A course's lecturers are derived from its resources; there is no course–lecturer link and no
  "current lecturer". There is no Section/branch field ("Section V" stays in titles).
- Slug rule: from the name, accents removed, lowercase, a leading title such as "Dr." / "Pr." /
  "Prof." dropped, every run of other characters turned into one hyphen
  ("Dr. Ali Ghorayeb" → `ali-ghorayeb`). On a clash, `-2`, `-3`… is added.

Lecturer service (new, admin only, `ForbiddenError` otherwise; same shape as the admin courses
service):

- `listAdminLecturers(viewer)`: every lecturer by name, each with `fileCount` (drafts included).
- `createLecturer(viewer, { name })` and `updateLecturer(viewer, id, { name })`: name normalised
  (trimmed, inner whitespace collapsed); a name taken ignoring case is `LecturerNameTakenError`
  (checked first and also caught from the unique index); rename never touches the slug;
  `NotFoundError` for a malformed or unknown id.
- `deleteLecturer(viewer, id)`: refused with `LecturerInUseError { fileCount }` while any resource
  (draft or published) uses it.
- API through `adminWrite`: `GET` / `POST /api/v1/lecturers` (`{ name }`, 201 `{ lecturer: { id,
  name, slug } }`), `PATCH` / `DELETE /api/v1/lecturers/ID` (200 `{ lecturer }` / 204); 400
  `{ error: "Invalid input", fields }`, 409 `{ error: "name_taken" }` or `{ error: "lecturer_in_use",
  fileCount }`, 404 for an unknown or malformed id, 401/403 as the other admin writes.

Resources:

- Resource create and update (single form, bulk upload, API) accept `lecturerId` (UUID or `null`).
  An id that is malformed or names no lecturer is a 400 field error on `lecturerId`.
- `ResourceListItem` and the reader's resource detail gain `lecturer: { slug, name } | null`.
- `listResources` (admin and public) accepts a `lecturer` slug filter.

Course and chapter pages (public, never read the session):

- `getCourseByCode(viewer, code, { lecturer })` and `getChapterPage(viewer, code, position,
  { lecturer })` take an optional lecturer slug. An unknown slug is ignored (treated as none).
- Both return, besides the (filtered) content:
  - `lecturers`: one entry `{ slug, name, fileCount }` per lecturer with at least one **published**
    file in scope (the course, or the chapter on a chapter page), ordered by name. `fileCount`
    counts that lecturer's published files in scope, solutions included.
  - `allFileCount`: every published file in scope, files with no lecturer included.
  - `lecturer`: the applied `{ slug, name }` or `null`.
- With a lecturer applied, only that lecturer's files are listed: in chapters (a chapter left with
  none of them is left out of the chapter cards, and its card describes only the kept files), in the
  previous exams, in other material and in the type tabs of a course without chapters. A kept row
  keeps its solution links as today. Files with no lecturer appear only with no lecturer applied.
- Progress (`GET /api/v1/progress/...`, the progress block, chapter progress text and bars) is
  untouched: always the whole course.
- The "Taught by" strip (from the mockup, variant C) is shown only when `lecturers` has two or more
  entries. It is a list labelled "Lecturer" under a small "TAUGHT BY" heading, placed above the
  course area tabs. Cards: "All lecturers" (`allFileCount` files) first, then one per lecturer: a
  40px circle with initials (from the name, title such as "Dr." left out), the name (truncated) and
  "N files". The selected card has a primary border and a light primary tint, its circle filled
  primary, and `aria-current="true"`. From sm up the cards sit in a 4-column grid (wrapping to more
  rows); on a phone they scroll sideways at about 160px each, bleeding to the screen edge. Cards are
  links: they change only `lecturer` in the address and keep `tab`.
- While a lecturer is applied, a muted line "Showing files by NAME only." with a "Show all" link
  (dropping only `lecturer`) sits above the area content.
- The address key is `lecturer=<slug>`. The area tabs, chapter card links and the chapter page's
  Previous / Next / back links keep it. The reader's Back link does not carry it.
- On a chapter page reached with a lecturer who has nothing in that chapter, the list area shows a
  state block "No files by NAME in this chapter." with "Show all files". The strip there lists only
  the chapter's lecturers, so no card is marked current; the line and "Show all" still show.

Rows and reader:

- `ResourceRow` shows the lecturer's name as a muted line ("Dr. Mohamad Hamze") when there is one;
  in rows that use `lead` (exams) it follows the title line. Nothing is shown without a lecturer.
- The reader's details column gains a "Lecturer" item (only when there is one).

Exams page:

- `ExamParams` gains `lecturer` (a slug; unusable values ignored like the others) and the results
  filter by it. `listExamFilterOptions` returns `lecturers: { slug, name }[]` (lecturers with at
  least one visible exam, by name). The filter form gets a fifth "Lecturer" dropdown ("All" first)
  and keeps working without JavaScript; the grid becomes five columns from lg up.

Search:

- A file's searchable text includes its lecturer's name, matched with the same rules as its title
  (case and accents ignored, prefix words). No new results section; lecturer matches are not
  highlighted (the row already shows the name).

Admin interface:

- Admin bar order: Resources, Courses, Lecturers, Chapters, Storage, Users.
- `/admin/lecturers` (admin only, server-rendered, `noindex`, `no-store`; not found for a student,
  sign-in for a visitor) follows `/admin/courses`: title "Lecturers", a "New lecturer" card (Name,
  "Add lecturer"), a count ("5 lecturers"), then rows of name, slug (muted, monospace) and "N files",
  with Edit (a dialog with Name; "Renaming keeps the lecturer's address (?lecturer=SLUG)") and
  Delete (an `AlertDialog` "Delete NAME?"; when the server answers 409 the dialog says "NAME is
  used by N files. Change or clear their lecturer first."). Toasts "Lecturer added." / "Lecturer
  saved." / "Lecturer deleted."; a 409 name clash shows "A lecturer with this name already exists."
  under Name. Forms use `method="post"` and stay disabled until hydrated, like the courses page.
- Resource form: "Lecturer" native select ("None" plus every lecturer by name).
- Bulk upload: "Lecturer for the whole batch" select beside Visibility ("None" default). Each row
  has its own Lecturer select, set from the batch choice when the row is added and when the batch
  choice changes (rows changed by hand keep their value).
- Admin resource list: a Lecturer filter (`?lecturer=`) next to the course filter.

Docs: `CLAUDE.md` (domain model, design bullets for the course page, chapter page, exams page,
search, reader and admin), `docs/backend-architecture.md` (routes) and `GLOSSARY.md` are updated in
the same PRs as the behaviour.

## Testing Decisions

- Good tests check behaviour through the public seam, never internals: given these lecturers,
  resources and a slug, this is what the course page data, the exam options or the search results
  contain; given this admin request, this is the answer and what is stored.
- Main seam: service functions against a real test database (Vitest), following the existing
  courses, chapters, resources, search and admin-courses service tests:
  - lecturer service: create, normalise, duplicate name ignoring case, rename keeps the slug, slug
    clash suffix, delete refused while in use (draft-only use included), admin-only;
  - resource writes: set, change and clear `lecturerId`; unknown id refused;
  - `getCourseByCode` / `getChapterPage`: lecturers listed only from published files, counts
    (solutions included, `allFileCount` includes files with no lecturer), filtering of chapters /
    exams / general / type groups, chapters left out when empty, unknown slug ignored, drafts never
    leak a name;
  - exams: options list only lecturers with a visible exam; results filter by lecturer and combine
    with the other filters;
  - search: a lecturer name finds their published files, accents and case ignored, drafts excluded.
- Browser journeys (Playwright, following `course-chapters`, `exams` and `admin-courses` specs, on
  the seeded test database with local storage):
  - a student picks a lecturer card, the address gains `lecturer=`, the lists narrow, the "Show
    all" line appears, the choice survives switching areas and opening a chapter, and Back restores
    the previous view;
  - the Exams page Lecturer dropdown narrows the results;
  - the admin adds a lecturer, renames it (slug unchanged), assigns it on a resource, and cannot
    delete it while in use.
- The seed gains a few obviously fake lecturers on demo courses (not on DEMO610 or DEMO410 files
  that the progress demos rely on for counts), so the strip shows in development and e2e.
- No separate component tests; page rendering is covered by the journeys above.

## Out of Scope

- More than one lecturer per file (the one co-authored project gets one or none).
- Lecturer pages or profiles (a page per lecturer, photos, emails).
- A Section/branch field, or any "current lecturer" / default filter.
- Filtering by lecturer on the reader (its Back link drops the filter), Saved, To-do, Progress, the
  semester pages and Home.
- An "Unknown lecturer" card or filter.
- Highlighting lecturer-name matches in search results.
- The one-off cleanup of existing production titles ("(Dr. X)" moved into the new field for the 31
  I3302 files): done by hand through the admin pages after release.

## Further Notes

- The mockup lives on the throwaway branch `prototype/lecturer-filter` (commit 11cdc50) and is
  never merged; it used fake lecturers and counted only files with a lecturer on the "All" card,
  which this spec corrects (`allFileCount`).
- Production already has PHP material from four lecturers, so I3302 is the natural first check
  after release.
- Suggested split for `/to-tickets` (each leaves the app working): schema + lecturer service + admin
  Lecturers page; lecturer on resource forms, bulk upload, rows, reader and admin list filter;
  course and chapter page strip and filtering; Exams page dropdown and search.
