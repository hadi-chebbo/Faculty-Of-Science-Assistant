# Spec: Saved resources and the to-do board

Status: draft for review (2026-10-24). Decisions come from the grilling session and the prototype
on the `prototype/todo-board` branch (`/prototype/todo`, variant D, and `/prototype/saved`,
variant A). That branch is never merged; it is the primary source for the look of these screens.
Terms follow `GLOSSARY.md`.

## Problem Statement

A student finds a lecture, an exercise set or an old exam they want to come back to, and has
nowhere to keep it: they reopen Drive links, take screenshots or search again from scratch. They
also have no place to plan their own study ("revise chapters 1–3", "redo exercise 4", "ask the TA
about 2b"), so the plan lives in their head, a notes app or a paper list that is separate from the
material it is about. Nothing about this feels rewarding to use.

## Solution

Two features for signed-in students (and the admin), stored on the server so they follow the
student to any device:

1. **Saved resources.** One tap on a bookmark icon keeps a resource. A **Saved** page lists what
   they kept, grouped by course, and each item can be put on the to-do board in one more tap.
2. **To-do board.** A private board with three fixed columns: **To do**, **In progress** and
   **Done**. A card is a note, a note with a linked resource, or just a linked resource. Cards move
   by dragging (desktop), by one-tap **Start** / **Done** buttons, or by a **Move to…** menu
   (everywhere). Every move can be undone, and finishing something is marked by a small
   celebration. A card opens into a larger view, like a Jira issue, where changes save as you type.

Browsing, reading and downloading still never need an account. Signed-out visitors see the save
icon; tapping it takes them to sign-in and back to the same page.

## User Stories

### Saving

1. As a signed-in student, I want to tap a bookmark icon on any resource row, so that I can keep a file without opening it.
2. As a signed-in student, I want to save from the reader's More actions menu, so that I can keep the file I am reading.
3. As a signed-in student, I want a "Save for later" button in the reader's details column, so that saving is visible without opening a menu.
4. As a signed-in student, I want the bookmark icon to look filled when a resource is already saved, so that I can see at a glance what I have kept.
5. As a signed-in student, I want to tap a filled bookmark to remove the resource from my saved list, so that unsaving is as quick as saving.
6. As a signed-in student, I want a short confirmation after saving ("Saved. Find it any time under Saved."), so that I know it worked and where to find it.
7. As a signed-in student, I want the save icon on course, chapter, exams and search pages, so that I can save from wherever I spot a file.
8. As a signed-out visitor, I want to see the save icon too, so that I discover the feature.
9. As a signed-out visitor, I want tapping save to take me to sign-in and then back to the same page, so that I do not lose my place.
10. As a signed-out visitor, I want the sign-in page to offer "Create an account", so that I can get an account if I have none.
11. As a student, I want saving twice to be harmless, so that a double tap does not cause an error.
12. As a student, I want the saved state to load after the page appears, so that public pages stay fast.

### Saved page

13. As a signed-in student, I want a Saved page reachable from the main navigation, so that I can find what I kept.
14. As a signed-in student, I want saved resources grouped by course, in semester and course-code order, so that the list matches how I study.
15. As a signed-in student, I want the most recently saved resource first within each course, so that what I just kept is easy to find.
16. As a signed-in student, I want each saved item to look like the resource rows I know, so that I can open it in the reader the same way.
17. As a signed-in student, I want to remove an item from the Saved page, so that the list stays useful.
18. As a signed-in student, I want an "Add to to-do" action on each saved item, so that I can turn something I kept into a plan.
19. As a signed-in student, I want a friendly empty state with a link to browse courses, so that an empty page tells me what to do.
20. As a signed-in student, I want resources that were withdrawn to disappear from my Saved page, so that I never hit a dead end.
21. As a signed-out visitor who opens /saved, I want to be sent to sign-in and brought back, so that a shared or bookmarked link still works.

### Board: seeing it

22. As a signed-in student, I want a To-do page reachable from the main navigation, so that I can open my plan from anywhere.
23. As a signed-in student, I want three columns, To do, In progress and Done, each with its own colour, icon and count, so that I can read the board at a glance.
24. As a signed-in student, I want each card to show its title, a short preview of its note, and for a linked file its course code and type, so that I recognise it without opening it.
25. As a signed-in student, I want a card to say when it was added, or for a done card when it was finished, so that I notice what has been sitting there.
26. As a signed-in student, I want an Open button on a card with a file, so that I can go straight to the reader.
27. As a signed-in student, I want a card whose file was withdrawn to say "This file is no longer available", so that I understand why it has no link.
28. As a signed-in student, I want each empty column to show a short, friendly message, so that the board never looks broken.
29. As a signed-in student on a phone, I want one column at a time, chosen by tabs with counts, so that the board fits my screen.
30. As a signed-in student, I want my board to be private, so that no one else ever sees it.

### Board: adding and editing

31. As a signed-in student, I want an "Add a card" action in every column, so that I can add a card where it belongs.
32. As a signed-in student, I want a New card button and the N key on desktop, so that adding is fast.
33. As a signed-in student on a phone, I want a round "+" button, so that I can add a card with my thumb.
34. As a signed-in student, I want to type a title and press Enter to add a card, so that adding takes seconds.
35. As a signed-in student, I want to link one of my saved files while adding a card, so that the card points to the material.
36. As a signed-in student, I want to tap "Add to to-do" in the reader or on the Saved page, so that a file becomes a card in To do in one step.
37. As a signed-in student, I want a message "Added to To do · View board" after that, so that I can jump to the board.
38. As a signed-in student, I want to add the same file to more than one card, so that I can plan different things about it.
39. As a signed-in student, I want a card with a linked file to need no title of its own, so that the file title can stand in.
40. As a signed-in student, I want to open a card into a larger view, so that I can edit its title and note comfortably.
41. As a signed-in student, I want my edits to save as I type, so that I never lose them and never press Save.
42. As a signed-in student, I want to see when a change failed to save and have it retried, so that I can trust the autosave.
43. As a signed-in student, I want to link, change or remove the file of a card from its view, choosing from my saved files, so that I can fix a card later.
44. As a signed-in student, I want to see the note length against the 2,000-character limit, so that I am not cut off by surprise.
45. As a signed-in student, I want to delete a card from its view or its menu, so that I can drop plans I no longer need.

### Board: moving cards

46. As a signed-in student, I want a Start button on To do cards and a Done button on In progress cards, so that the usual move is one tap.
47. As a signed-in student on desktop, I want to drag a card to another column, so that the board feels like Jira.
48. As a signed-in student on desktop, I want to drag a card up or down within a column, so that I can put what matters first.
49. As a signed-in student, I want a Move to… menu with the other columns, Move up and Move down, so that I can move cards without dragging, on any device.
50. As a keyboard user, I want to pick up and move a card with the keyboard and hear where it went, so that the board works without a mouse.
51. As a signed-in student, I want a moved card to go to the top of its new column, so that I see it straight away.
52. As a signed-in student, I want a new card to appear at the top of its column, so that I see it straight away.
53. As a signed-in student, I want an Undo button after every move and delete, so that a slip costs nothing.
54. As a signed-in student, I want a small check animation and "Nice, that's done." when a card reaches Done, so that finishing feels good.
55. As a student who turned on reduced motion, I want no animations, so that the board does not bother me.
56. As a signed-in student, I want done cards to stay in Done until I delete them, so that I can look back at what I finished.
57. As a signed-in student, I want moving a card to Done to not mark the file itself as done, so that the plan and progress stay separate.

### Board: finding cards

58. As a signed-in student, I want to filter cards by typing, so that I can find one card on a full board.
59. As a signed-in student, I want chips for each course on my board and for notes only, so that I can focus on one subject.
60. As a signed-in student, I want the column counts to follow the filter, so that the numbers match what I see.

### Limits and edges

61. As a signed-in student, I want a clear message when I reach 500 cards, so that I know to clear old ones.
62. As a signed-in student, I want titles up to 200 characters and notes up to 2,000, so that cards stay readable.
63. As a signed-in student, I want a card to keep its title and note when its file is deleted, so that my plan is not lost.
64. As a signed-in student whose session expired, I want /todo and /saved to renew my session silently, so that I am not asked to sign in again too often.
65. As the admin, I want Saved and the board too, so that I can test them in production.

## Implementation Decisions

### Scope and rules
- Signed-in users only (students and the admin). Public pages still never read the session on the
  server: saved state is fetched by the browser after the page has loaded, like the header account
  control does.
- "Saved resource" in the interface; the existing, unused `bookmarks` table stores it.
- A card in Done is not itself a completion and nothing is turned into a percentage. (Replaced by
  `docs/specs/progress-tracking.md`: moving a card with a linked file into Done now marks that file as done.)
- Drafts are never shown outside /admin: a resource that is not published is hidden from Saved and
  shown on a card only as "This file is no longer available", without its title or a link.

### Schema
- `bookmarks`: unchanged (one row per user and resource, cascades on delete of either).
- New table `todos` (one migration), modelled on this shape from the prototype:

  ```ts
  type Status = "todo" | "in_progress" | "done";
  type Card = {
    id: string;              // uuid
    userId: string;          // FK users, cascade
    status: Status;          // check constraint
    position: number;        // integer, 0 = top, unique-ish within (user, status); renumbered on write
    title: string;           // ≤ 200, may be "" when a resource is linked
    note: string;            // ≤ 2000, "" when none
    resourceId: string | null; // FK resources, ON DELETE SET NULL
    createdAt: Date;
    updatedAt: Date;
    statusChangedAt: Date;   // drives "Done 2 days ago"
    deletedAt: Date | null;  // soft delete, so Undo can restore a deleted card
  };
  ```

- Index on (user_id, status, position) for live rows. Check constraints for status and lengths.
- "Title or resource" is enforced by the service on every write, not by the database, because
  `SET NULL` on a deleted resource must not fail. A card left with neither shows "A file that was
  removed" as its title.
- Soft-deleted cards older than one day are purged for that user whenever their board is loaded;
  no cron is needed.

### Services (new modules beside the existing ones)
- **Saved**: save (idempotent; only published resources, otherwise not found), unsave
  (idempotent), list for the Saved page (published only, grouped by course in semester and
  course-code order, newest save first, using the existing resource list item shape so the row
  can be reused), list of saved resource ids.
- **Todos**: list board (live cards ordered by status then position; also purges old soft
  deletes), create (status defaults to To do, goes to position 0), update (title, note, resource),
  move (to a status and an index within it; renumbers both columns in one transaction; sets
  `statusChangedAt` when the status changes), delete (soft), restore (undo a delete, back to the
  same status and position), with the 500-card limit checked on create and restore.
- Linking a resource to a card accepts any published resource (the interface offers saved ones).
- All services take the viewer and act only on that viewer's rows; another user's card id is
  "not found", never "forbidden".

### API (JSON, `no-store`, same-origin check on every write, 401 when signed out)
- `GET /api/v1/saved` (the Saved page list), `GET /api/v1/saved/ids` (ids for row icons),
  `PUT /api/v1/saved/{resourceId}` and `DELETE /api/v1/saved/{resourceId}` (204 either way).
- `GET /api/v1/todos`, `POST /api/v1/todos`, `PATCH /api/v1/todos/{id}`,
  `POST /api/v1/todos/{id}/move` (`{ status, index }`), `DELETE /api/v1/todos/{id}`,
  `POST /api/v1/todos/{id}/restore`.
- Validation with Zod; field errors as 400 in the existing error shape; 409 `board_full` at 500
  cards; 404 for an unknown, foreign or unpublished resource.

### Sign-in return path
- `/sign-in?next=/some/path` sends the user back there after signing in, reusing the existing
  `safeNextPath` check (same-site relative paths only); the default stays as today. Save icons and
  the private pages use it.

### Pages and components
- `/saved` and `/todo`: private, server-rendered, `noindex`, `no-store`. A missing or expired
  access token goes through the existing session-restore route with `next`, then to sign-in with
  `next`. Built from shadcn/ui components; Dialog is added through the shadcn CLI.
- Account menu gains "Saved" and "To-do" for every signed-in user. No new bottom tab.
- **Save icon** (client component) on the shared resource row and in the reader (More actions and
  the details column). One request for saved ids per page, shared by all icons on it.
- **Board** follows prototype variant D: tinted columns with a coloured top bar, rich cards,
  per-column "Add a card", New card button and N key, phone tabs and a floating "+" button,
  card view dialog (title and note left; status, dates and Delete right; autosave debounced about
  half a second), toast with Undo for moves and deletes, a check animation on reaching Done
  (off with `prefers-reduced-motion`).
- Drag and drop uses the existing `@dnd-kit` packages (no new dependency): pointer and keyboard
  sensors, screen-reader announcements, desktop only. Move to… and Start / Done work everywhere.
- The board updates optimistically and rolls back with a message if the server refuses.
- Filtering (text box, course chips, notes only) happens in the browser over the loaded board.
- A new `success` colour token (green) in `globals.css` for both themes, used only for Done: the
  column bar, the check mark and the Done button. Text on it meets 4.5:1. CLAUDE.md's design
  section is updated in the same change.

## Testing Decisions

- Good tests check behaviour through the highest seam that shows it: what a service returns and
  stores, what a route answers, and what a student sees and can do in the browser. They never
  assert on internal helpers or component structure.
- **Service tests** (Vitest against the test database), the main seam: save and unsave are
  idempotent; drafts cannot be saved and vanish from lists; ordering of the Saved page; cards are
  per user; create, move and reorder keep positions gapless; status change sets
  `statusChangedAt`; delete then restore returns the card to its place; purge of old deletes;
  the 500 limit; title-or-resource rule; resource deletion keeps the card. Prior art: the chapters
  and resources service tests, which also cover reordering.
- **Route tests** (calling the route handlers directly): 401 signed out, refused cross-origin
  writes, 400 field errors, 404 for someone else's card, 409 when full. Prior art:
  `sign-up-routes.test.ts`.
- **Migration test**: up and down of `todos`. Prior art: `email-confirmed-migration.test.ts`.
- **Playwright journeys** (on the fresh seeded database with local storage, as in the e2e run
  recipe): signed-out save leads to sign-in and back; save from the reader appears on /saved and
  unsave removes it; add a note card, Start it, Done it, Undo; Add to to-do from Saved; drag a card
  between columns on desktop and Move to… on a phone viewport; the card view autosaves across a
  reload. Prior art: `reader.spec.ts`, `admin-chapters.spec.ts` (drag), `sign-in-page.spec.ts`.

## Out of Scope

- Due dates, priority, labels, reminders, custom or renamed columns, course lanes (swimlanes).
- "Mark as done" (completions) and any progress display.
- A search picker for linking any resource from the board (only saved resources are offered).
- Live sync between tabs or devices (a reload shows the latest).
- A "Clear done" action, sharing boards, export.
- A Saved or To-do item in the phone bottom tab bar.
- Automatically saving after sign-in.

## Further Notes

- Suggested order: Saved backend, sign-in return path, Save on reader, Save on rows, Saved page;
  then board backend, board page, moving cards, Add to to-do, filters. Part A can ship before
  part B is finished.
- Undo of a move goes back to the earlier column and place; its "since" date becomes the time of
  the undo. This is accepted as minor.
- The prototype branch also added shadcn Tooltip; it is not needed unless a ticket uses it.
