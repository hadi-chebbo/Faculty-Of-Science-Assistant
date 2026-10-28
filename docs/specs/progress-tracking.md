Spec for the progress-tracking sprint. Decisions come from a grilling session (two rounds, all
recommendations accepted) and approved mockups:
https://claude.ai/artifact/QwJB6kk5iqt6CjXtVEY6nv (reader, course page, `/progress` on desktop and
phone, Home band, celebrations, to-do Done). Terms follow `GLOSSARY.md` (Completion, Counted
resource, Chapter progress, Course progress, Exam practice, Finished, My courses, Active day,
Milestone).

## Problem Statement

A student working through a semester has no way to see how far they have got. They open lectures
and exercise sheets, but nothing remembers which ones they actually finished, so before a partial
exam they cannot tell which chapters are covered and which are still untouched. The to-do board
lets them plan, but finishing a file there leaves no trace on the course itself. Working through a
course never feels like it adds up to anything, so there is little pull to keep going.

## Solution

A student marks a file as done when they have finished it, with one button in the reader, or by
moving a to-do card linked to it into Done. From those marks, and only those, the platform shows
their progress:

- A ring on each course (how many counted files are done), a bar on each chapter, a separate
  "Exams: x of y done" counter, and a quiet check on every finished file in the lists.
- A private **Progress** page with every course they have started, grouped by semester, how many
  days this week they studied, and a small set of milestones they have earned.
- A light reward when something is finished: a toast with Undo for every mark, a short
  celebration when a chapter is finished, a bigger one (with a little confetti) when a whole course
  is, and a one-time toast when a milestone is earned.

There are no points, levels, leaderboards or streaks that can be lost; nothing compares students.
Opening or downloading a file never counts. Browsing and reading stay public and never need an
account.

## User Stories

Marking files

1. As a student, I want a "Mark as done" button in the reader, so that I can record that I have
   finished a file while I am looking at it.
2. As a student, I want the button to turn into a green "Done ✓" once pressed, so that I can see at
   a glance that this file is finished.
3. As a student, I want to press "Done ✓" again to un-mark the file, so that I can correct a
   mistake.
4. As a student, I want a toast with Undo after every mark and un-mark, so that a mis-tap costs
   nothing.
5. As a student, I want marking to feel instant, so that the platform feels responsive on a slow
   connection.
6. As a student, I want a failed mark to be put back with a message, so that what I see always
   matches what was saved.
7. As a student, I want "Mark as done" / "Mark as not done" in the reader's More actions menu too,
   so that I can reach it in focus mode and on a phone.
8. As a student on a phone, I want the button in the details under the document, next to Save and
   Add to to-do, so that I find all file actions in one place.
9. As a student, I want to see right under the button how far I am in this chapter ("Chapter 2: 4
   of 5 files done"), so that each mark shows me what it means.
10. As a student reading an exam, I want to see "Exams: 3 of 6 done" instead, so that exams are
    tracked apart from chapter material.
11. As a visitor, I want to see "Mark as done" and be taken to sign in when I press it, then back to
    the same file, so that I understand what an account gives me.
12. As a visitor, I want nothing to be marked automatically after I sign in, so that I stay in
    control.
13. As a student, I want opening or downloading a file to never count as done, so that my progress
    means what I say it means.
14. As a student, I want the Mark as done button only on lectures, notes, exercises and exams, so
    that I am not asked to mark solutions or miscellaneous files that never count.

Seeing progress in place

15. As a student, I want a read-only check next to every file I finished, in every file list
    (course page, chapter pages, exams, search results, Saved), so that I can spot what is left.
16. As a student, I want unfinished counted files to show an empty circle, so that I see what is
    still to do.
17. As a student, I want the course page header to show a ring with my course progress, "8 of 13
    files done" and "Exams: 2 of 6 done", so that I know where I stand in the course.
18. As a student, I want each chapter card to show a bar and "4 of 5 done", so that I know which
    chapters need work.
19. As a student, I want a finished chapter's card to say "✓ Finished" in green, so that finishing
    feels visible.
20. As a student, I want a chapter I have not started to say "Not started · 5 files", so that it is
    clear without looking like a failure.
21. As a student, I want each course card on a semester page to show my ring, so that I can compare
    my courses at a glance.
22. As a student, I want the course ring to link to my Progress page, so that I can see the detail.
23. As a visitor, I want the public pages to look exactly as they do today, so that nothing points
    at features I cannot use.
24. As a student, I want the pages to show first and my progress to appear right after, so that my
    progress never slows down browsing.

The Progress page

25. As a student, I want a private Progress page, so that I can see all my progress in one place.
26. As a student on desktop, I want "Progress" in the main navigation, after To-do, so that I can
    reach it from anywhere.
27. As a student on a phone, I want to reach Progress from a band on Home and from any course ring,
    so that the bottom tab bar stays uncluttered.
28. As a visitor, I want the Progress nav item to take me through sign-in and back, like Saved and
    To-do.
29. As a student, I want the page to list only the courses I have marked something in, so that I do
    not face a wall of 0%.
30. As a student, I want those courses grouped by semester, so that the page follows how my year is
    organised.
31. As a student, I want each course card to show its ring, "x of y files", "Exams: x of y done"
    and a bar per chapter (plus General for files in no chapter), so that I see which chapters are
    left.
32. As a student, I want each course card to link into the course, so that I can continue from
    there.
33. As a student, I want to see "This week" as seven dots (Monday to Sunday) with my active days
    filled and today outlined, and "3 active days this week", so that I see my rhythm without being
    shamed for a gap.
34. As a student, I want an active day to stay counted even if I later un-mark that day's file, so
    that the count only ever grows.
35. As a student, I want to see the six milestones, earned ones in colour and the others muted, so
    that I know what I can still reach.
36. As a student with nothing marked yet, I want a friendly empty state with a "Browse courses"
    button, so that I know how to start.
37. As a student, I want the page to say its numbers come only from files I marked as done, so that
    I trust them.

Home

38. As a signed-in student, I want a "Your progress" band on Home with up to three of my courses
    (the most recently marked first), each with its ring and "x of y files", and a "See all" link,
    so that I can jump back in.
39. As a signed-in student with nothing marked yet, I want the band to say "Mark files as done in
    the reader to track your progress here.", so that I discover the feature.
40. As a visitor, I want no progress band on Home, so that the landing page stays about the
    platform.

Rewards

41. As a student, I want a celebration when a mark finishes a chapter (a green pulse on the button
    and a toast "Chapter 2 finished!" with a "Next chapter" link when there is one), so that
    finishing feels rewarding.
42. As a student, I want a bigger celebration when a mark finishes a whole course (a small centred
    card "DEMO301 finished" with a little confetti, "See your progress" and Close), so that
    finishing a course feels like an event.
43. As a student, I want the celebration to play again if I finish a chapter again (for example
    after new material was added), so that re-finishing is rewarded too.
44. As a student who prefers reduced motion, I want no pulses or confetti, only the toast and the
    card, so that the platform respects my settings.
45. As a student using a keyboard or screen reader, I want the course-finished card to take focus,
    close with Esc, and return focus to where I was, and toasts to be announced, so that rewards
    are accessible.
46. As a student, I want a one-time toast when I earn a milestone ("Milestone: 10 files done" with
    "View"), so that I notice it.
47. As a student, I want the six milestones to be: first file done, 10 files done, 50 files done,
    first chapter finished, first course finished, and all past exams of a course done.
48. As a student, I want a milestone, once earned, to stay earned forever, even if I un-mark files
    or new material is added.
49. As a student, I want no points, levels, leaderboards or comparisons with others, so that
    progress stays personal.

To-do board

50. As a student, I want moving a card linked to a file into Done to mark that file as done, so
    that I do not have to mark it twice.
51. As a student, I want the toast to say "Nice, that's done. File marked as done too.", so that I
    know what happened.
52. As a student, I want Undo on that toast to put the card back and un-mark the file, unless the
    file was already done before, so that Undo restores exactly what was there.
53. As a student, I want moving a card out of Done to leave the file done, so that I do not lose
    progress by reorganising my board.
54. As a student, I want a card whose file is done to show "✓ File done" on its file tile, so that
    the board and my progress agree.
55. As a student, I want finishing a chapter or course through the board to celebrate exactly like
    the reader does.
56. As a student, I want a card with no file, or with a file no longer available, to move to Done
    exactly as today, so that nothing surprising happens.

Content changes

57. As a student, I want a chapter to stop being finished when a new counted file is published in
    it, so that my progress stays honest about what is left.
58. As a student, I want a file that is unpublished to drop out of my numbers, and my mark on it to
    come back if it is published again, so that withdrawn material does not distort my progress.
59. As a student, I want a deleted file to take its mark with it, so that nothing points at missing
    material.

Admin

60. As the admin, I want the same progress features as students, so that I can try them.
61. As the admin, I want progress to need no work from me when I upload or publish, so that it
    keeps running on its own.

## Implementation Decisions

Domain rules

- A completion is made only by an explicit act: "Mark as done" in the reader, or a to-do card
  linked to an available file moving into Done from another column. Opening, downloading or
  creating or editing a card never makes one. Moving a card out of Done never removes one. Only
  un-marking (the reader button, its menu item, or a toast Undo) removes one.
- Only a published resource of type lecture, notes, exercise or exam can be marked (anything else
  is a 404, like Save). Un-marking always succeeds, published or not.
- Counted resources: published lecture, notes and exercise. Chapter progress = completions of the
  chapter's counted resources / its counted resources. Course progress = the same over the whole
  course, chapter or General. Exam practice = completions of the course's published exams / its
  published exams. Solutions and other resources appear in no number. No figure ever merges these
  three.
- A chapter or course is finished when its total is at least 1 and done equals total. It is
  computed live, never stored, so a newly published counted resource un-finishes it and an
  unpublished one drops out of both numbers. A completion of an unpublished resource is kept and
  counts again on republishing; a deleted resource deletes its completions (existing cascade).
- My courses: courses with at least one completion of a currently published resource (any marked
  type). Order on the Home band: most recent completion first. Order on the Progress page: by
  semester, then course code.
- Active day: the calendar day in Asia/Beirut on which a completion was made. Recorded when the
  completion is made (also through the board) and never removed. The week runs Monday to Sunday,
  Beirut time.
- Milestones (fixed keys): `first_file`, `files_10`, `files_50`, `first_chapter`, `first_course`,
  `all_exams_of_course`. File counts use the student's completions of currently published resources
  of any markable type. A milestone is recorded the first time its condition becomes true on a
  mark and is never removed. `all_exams_of_course` needs a course with at least one published
  exam, all of them completed.
- Rewards are decided on the server by the mark itself, so the reader and the board behave the
  same: `chapterFinished` when this mark is a new completion of a counted resource and leaves its
  chapter finished; `courseFinished` likewise for the course (both may be true at once; the client
  shows the course card, which wins over the chapter toast); `milestones` lists the keys earned by
  this mark. A repeated mark of an already completed resource returns no rewards.

Schema (migrations, one table each, house migration style)

- `completions` already exists (id, user, resource, created_at, unique per user and resource,
  cascades) and is used as is.
- New `study_days`: user (cascade), day (DATE, the Beirut date), created_at; unique (user, day).
- New `milestones`: user (cascade), key (check constraint on the six keys), earned_at; unique
  (user, key).

Progress service (new module; the main test seam)

- `markDone(viewer, resourceId)` → `{ created, progress, rewards }`. Idempotent. In one
  transaction: insert the completion (ignoring a duplicate), record the active day, compute
  progress, award new milestones. `progress` holds the course (`code`, `done`, `total`,
  `finished`), exam practice (`done`, `total`) and, for a resource in a chapter, the chapter
  (`id`, `position`, `title`, `done`, `total`, `finished`). `rewards` is
  `{ chapterFinished: { position, title, nextChapter: { position, title } | null } | null,
  courseFinished: { code, title, filesTotal, exams } | null, milestones: key[] }`.
- `unmarkDone(viewer, resourceId)` → `{ progress }`. Never touches active days or milestones.
- `listCompletedIds(viewer)` → ids of completed resources that are published now.
- `getCourseProgress(viewer, courseCode)` → the course totals, exam practice and every chapter's
  progress (plus General). Used for the course page, chapter cards and the reader line.
- `getProgressOverview(viewer)` → this week (its Monday's date and the active dates in it), all six
  milestones with `earnedAt` or null, and My courses with their full course progress and the time
  of their latest completion.
- Progress is computed with count queries per course; nothing is cached or stored.

To-do service change

- `moveCard` marks the linked file through `markDone` inside its own transaction when the card
  enters Done from another column and its file is available. Its result gains `fileMarked`
  (true only when the completion is new) and `rewards`. The comment and CLAUDE.md rule saying
  Done never touches completions are replaced.
- A card's `resource`, when available, gains `done: boolean`, so the tile can show "✓ File done".
- Board Undo of such a move moves the card back and, when `fileMarked` was true, un-marks the file.

API (all under `/api/v1`, signed-in only, 401 otherwise; Zod-validated; same error shapes as Saved)

- `PUT /completions/:resourceId` → 200 `{ created, progress, rewards }`; 404 for a resource that is
  missing, unpublished or of a type that cannot be marked.
- `DELETE /completions/:resourceId` → 200 `{ progress }`.
- `GET /completions/ids` → `{ ids }`.
- `GET /progress` → the overview. `GET /progress/courses/:code` → the course progress; 404 for an
  unknown code.
- `POST /todos/:id/move` keeps its contract and adds `fileMarked` and `rewards` to the response.

Pages and components

- Public pages stay static and never read the session on the server. A shared browser store for
  completed ids (the twin of the saved-ids store) asks `GET /completions/ids` once per page load,
  only for a signed-in viewer, and the reader button, menu item and row checks all read it.
  Course-page and semester-page rings ask for the course progress after load; nothing is shown
  until the answer arrives and nothing moves when it does (space is reserved only where a visitor
  would also see it; the header ring appears beside the title without shifting it).
- Resource rows get a status cell on the left: a green check (label "Done") for a completed file,
  an empty circle (label "Not done") for a counted or exam file not completed, nothing for
  solutions and other, and nothing at all for visitors. It is read-only.
- Reader: in the desktop details column, after "Add to to-do", a full-width "Mark as done" outline
  button that becomes a filled success-green "Done ✓" (`aria-pressed`), followed by the progress
  line and bar (chapter, or exams for an exam, or the course for General). The phone shows the same
  in the details under the card. More actions gains "Mark as done" / "Mark as not done" after "Add
  to to-do". Marking is optimistic and queued like Save; failure rolls back with a toast. Signed
  out, it goes to `/sign-in?next=` this page.
- Toasts: "Marked as done. Chapter 2: 4 of 5." / "Marked as done." (with Undo) and "Marked as not
  done." (with Undo), using the shared undo toast. Milestone toasts: "Milestone: 10 files done"
  with "View" (to `/progress`), once per milestone.
- Celebrations: the chapter one is a ~600 ms success-green ring pulse on the Done button plus the
  toast "Chapter N finished!" with the chapter title and "Next chapter ›" when there is one. The
  course one is a shadcn Dialog: green check, "CODE finished", "You marked all N files of TITLE as
  done. Exams: x of y done.", "See your progress" and Close; a CSS-only confetti burst (a handful of
  pieces, about 1.5 s) behind it. All motion only under `prefers-reduced-motion: no-preference`;
  no new dependency. On the board, the card's existing Done ring plays and the same toast or
  dialog follows.
- Course page: a progress block beside the title (ring with percentage, "x of y files done",
  "Exams: x of y done") linking to `/progress`; chapter cards gain a bar and "x of y done", "✓
  Finished" in green, or "Not started · N files". Semester page course cards gain a small ring.
  A course or chapter with no counted files shows no ring or bar.
- `/progress`: private exactly like `/saved` (server-rendered, `noindex`, `no-store`,
  `requireSignedInPage` and the restore path with `next=/progress`). Title "Your progress" with the
  yellow bar and "Based only on the files you marked as done."; a "This week" panel (seven dots,
  active filled primary, today outlined, "N active days this week"); a "Milestones · n of 6"
  panel (earned: primary on a tint; not yet: muted dashed; never a "missing" message; phone scrolls
  sideways); then course cards grouped by semester (ring, linked title, "x of y files · Exams: x of
  y done", a bar per chapter in order and General, finished ones in green with ✓). Empty state:
  "Nothing marked as done yet. Open a file and press Mark as done to see your progress here." and
  "Browse courses".
- Navigation: "Progress" becomes a sixth item after To-do on md and up only (icon from lg like the
  others); the phone tab bar keeps five items. Signed out it goes through sign-in like Saved.
- Home: a "Your progress" band, loaded by the browser for signed-in viewers only, placed right
  after the hero: "N active days this week", up to three My courses rows (ring, code and title, "x
  of y files · P%", or "✓ Finished"), each linking to its course, and "See all ›" to `/progress`;
  the empty text when there are no completions. Visitors never see it and the page stays static.
- Colours: the success green stays reserved for Done and finished (now also the reader's Done
  button, finished chapters and courses, and row checks); progress in flight uses the primary.
  Rings and bars carry text equivalents ("62% done, 8 of 13 files").

Documentation

- CLAUDE.md: "Explicit mark as done" moves into the MVP; the Todo bullet and the To-do board
  section say a move into Done marks the linked file; new bullets for progress, the reader button,
  row checks, `/progress`, the Home band and the sixth nav item; the domain model gains StudyDay
  and Milestone.

## Testing Decisions

- Good tests check behaviour through the highest seam: given completions and published content in
  the test database, what does the service return, and what does a student see in the browser.
  They do not check queries, component internals or how the numbers are computed.
- Progress service (Vitest against the test database, like `saved.test.ts` and `todos.test.ts`):
  marking is idempotent and returns no rewards the second time; only markable published types can
  be marked; un-marking an unpublished file works; counted totals ignore solutions and other;
  exams are counted apart; chapter and course finish exactly at the last counted file; a newly
  published counted file un-finishes; unpublished files drop out and come back; each milestone is
  earned at the right mark and only once, and survives un-marking; active days use the Beirut date
  (a mark at 23:30 UTC is the next Beirut day) and survive un-marking; the overview lists only My
  courses, in order, and the week starts on Monday; another user's completions never leak.
- To-do service (`move-card.test.ts`): a move into Done with an available file marks it and returns
  `fileMarked` and rewards; an already completed file gives `fileMarked: false`; no file or an
  unavailable file marks nothing; a move within Done or out of Done changes no completion.
- API route tests like `saved-routes.test.ts` and `todos-routes.test.ts`: 401 signed out, 404s,
  response shapes.
- Playwright, like `saved-reader.spec.ts` and `todo-move.spec.ts`: mark in the reader, see the
  check on the chapter page row and the ring on the course page; finish a chapter and see the
  celebration toast, finish a course and see the dialog; un-mark with Undo; the visitor path to
  sign-in; `/progress` with data and empty; the Home band for a signed-in student and its absence
  for a visitor; to-do Done marks the file and its Undo un-marks it. Runs with the e2e recipe
  (fresh seeded database, local storage).

## Out of Scope

- Points, XP, levels, leaderboards, sharing or comparing progress, streaks that reset, reminders,
  notifications and emails about progress.
- Any signal other than an explicit completion: opened, read time, scroll position, assessed.
- Marking solutions or other files; bulk "mark chapter as done".
- A "My courses" selection or enrolment.
- Creating a card directly in Done, or linking a file to a card that is already in Done, does not
  mark the file (only a move into Done does).
- Progress for visitors or kept in the browser; admin statistics about students' progress.
- The AI assistant.

## Further Notes

- Choices made while writing the spec, not asked in grilling: Mark as done only on lecture, notes,
  exercise and exam (matching the mockup, where solutions show no check); creating a card in Done
  does not mark its file; when a chapter and the course finish on the same mark, only the course
  dialog shows; semester-page rings (agreed in grilling, not drawn in the mockups) are a small ring
  on each course card.
- The rule "Done on the board never touches completions" from the saved-and-todo sprint is
  deliberately reversed by the owner (2026-10-27).
- The seeded demo student should get a few completions so the e2e tests and local demos show
  progress.
