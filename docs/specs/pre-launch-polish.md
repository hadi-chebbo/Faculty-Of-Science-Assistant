Spec for the fixes agreed in the pre-launch UI/UX audit (#152, report `docs/ui-ux-audit.md`, section
"Review decisions", owner 2026-11-23). Finding ids (B1, S3, N7, ...) refer to that report. Terms follow
`GLOSSARY.md`.

## Problem Statement

The platform works, but a student opening it before the partial exams meets things that make it look unfinished or slow
them down:
- The browser tab shows the Next.js logo.
- Home and Search show fake "DEMO" course codes.
- Every course tab is titled just "Course", and a link shared in a chat group previews as a bare address.
- On a phone, a student has to scroll through about 1,300px of introduction before choosing their year. A returning student
  sees the same introduction as a first-time visitor.
- On a phone, the course and chapter pages have no way back up.
- Exams fills the first phone screen with five dropdowns and names courses only by code.
- Download is hidden in a menu.
- Courses that have no files yet look like real ones and lead to empty pages.
- Small slips: "all 1 files done", the to-do + button covering a card, text as small as 10px.

## Solution

One round of polish, in small independent changes, before launch:
- A proper favicon.
- Honest example text.
- Real page titles and link previews.
- Phone back links.
- A compact Exams filter on a phone, with course names in rows.
- A Home that puts the year choice, and for a signed-in student their progress, first.
- A visible Download button in the reader.
- Muted cards for courses without files.
- Accessibility and touch details.
- A little admin convenience.

Nothing changes about what material exists or who can see it. The exams year grid (S12) was rejected and is not part of it.

## User Stories

1. As a student, I want the browser tab to show the site's own icon, so that I can find it among my open tabs and bookmarks.
2. As a student, I want the Home preview of a course to be a generic example with no made-up course code, so that I do not
   look for a course that does not exist.
3. As a student on Search, I want the hints to give a real example or none, so that following a hint never leads to nothing.
4. As a student, I want a course tab to be titled with the course code and title, so that I can tell my open tabs apart.
5. As a student, I want a chapter tab to be titled with the course code, chapter number and chapter title, so that my
   history and bookmarks make sense.
6. As a student sharing a course link in a WhatsApp or Telegram group, I want a preview with the site's name, a
   description and an image, so that classmates trust and open it.
7. As a student on a phone, I want the browser bar to match the site's background in light and dark mode, so that the site
   feels finished.
8. As a student who finished a chapter with one file, I want the toast to read naturally ("1 file", not "1 files"), so
   that the site does not look careless. The same applies to the course-finished dialog.
9. As a keyboard user, I want a "Skip to content" link that appears on focus, so that I do not tab through the header on
   every page.
10. As a student on a phone, I want no text smaller than 12px, so that times, counters and empty-column texts are readable.
11. As a student, I want loading labels to use the same ellipsis everywhere ("Signing in…"), so that the wording is
    consistent.
12. As a student typing my email on a phone, I want no autocorrect, spellcheck or automatic capital, so that my address
    is not changed.
13. As a student on a phone, I want taps to respond at once, without a double-tap zoom delay, so that the site feels quick.
14. As a student on a phone, I want the page behind a sidebar, sheet or dialog not to scroll when I reach the end of it,
    so that I do not lose my place.
15. As a student who prefers reduced motion, I want year cards not to move on hover, so that the site respects my
    setting.
16. As a student on the sign-up, check-email or confirm-email page, I want a "Back to courses" link, so that I can go
    back to browsing without signing up.
17. As a visitor reading the FAQ, I want the account answer to say that Saved, To-do and Progress need an account while
    browsing and downloading never do, so that I know what an account adds.
18. As a student who mistyped an address, I want the 404 page to offer Browse courses and Search besides going home, so
    that I can recover in one tap.
19. As a student reading a file, I want a visible "Download PDF" button under "Mark as done", so that I can save the file
    for offline study without opening a menu.
20. As a student on a phone on a course page, I want a back link to my year ("‹ Second year") above the title, so that I
    can go up without the browser's Back button.
21. As a student on a phone on a chapter page, I want a back link to the course ("‹ I3305") above the title, so that I can
    go back to the course's chapters.
22. As a student on a desktop, I want the breadcrumbs to stay as they are, so that nothing changes where it already
    works.
23. As a student on a phone on Exams, I want the filters folded into one "Filters" control that shows how many are active,
    so that the first screen shows exams.
24. As a student on a phone, I want opening the filters to show the same five choices with Apply, and the page to keep
    working without JavaScript, so that nothing is lost.
25. As a student, I want each exam row to show the course title beside its code, so that I recognise "Algorithms" without
    remembering its code.
26. As a student on Search, I want file rows to show the course title beside the code too, so that results are as
    readable as on Exams.
27. As a visitor on a phone, I want "Choose your year" right after the hero's headline and buttons, before the preview card,
    so that I reach my year in one short scroll.
28. As a signed-in student on a phone, I want "Your progress" first and the introduction reduced to one line with its
    buttons, so that I continue studying at once.
29. As a signed-in student, I want Home not to jump when my progress appears, so that I do not tap the wrong thing.
30. As a student whose session has ended, I want Home to fall back to the visitor layout without a lasting empty gap, so
    that a stale hint does not break the page.
31. As a student on a desktop, I want Home's order unchanged, so that the wide layout stays as designed.
32. As a student on a year page, I want a course with no files yet to show a muted "No files yet" card that is not a link,
    so that I do not open an empty page.
33. As a student, I want course cards to align their content at the top, so that codes and titles line up side by side.
34. As a student on Search, I want a course with no files to show the same muted, non-link look, so that results never
    lead to a dead end.
35. As a student on the to-do board on a phone, I want room at the end of each column, so that the + button never covers
    the last card's buttons.
36. As a student on a phone, I want a soft fade at the edge of rows that scroll sideways (course tabs, search chips), so
    that I know there is more.
37. As a student in focus mode on a phone, I want a visible Exit button, so that I can leave without a keyboard or a menu.
38. As a signed-in student on Saved, I want a long course title in a group heading limited to two lines, so that groups
    stay compact.
39. As a student on a course with 5 or more lecturers, I want the "Taught by" strip as one row that scrolls sideways, so
    that the material is not pushed down.
40. As the admin, I want a search box on the resource list that matches titles and course codes, so that I find a file
    among hundreds without paging.
41. As the admin on a phone, I want the admin tabs in one row that scrolls sideways, so that they do not wrap among other
    controls.
42. As a screen-reader user, I want the new controls (Filters, Download, back links, Exit, Skip to content) to be properly
    labelled and reachable by keyboard, so that the polish does not cost accessibility.

## Implementation Decisions

Site-wide:
- **Favicon (B1):** a simple "UA" mark in the primary blue, as Next metadata files (icon, Apple icon, and a `.ico`
  fallback). Next.js's leftover sample SVGs in the public folder are deleted.
- **Placeholder text (B2):**
  - The Home hero preview becomes a static generic example with no course code: "Your course", the tabs Chapters /
    Previous exams, and rows like "Chapter 1: Introduction" and "Final exam 2024-2025".
  - On a phone its tab labels must not be cut off: short labels, or a row that scrolls.
  - Search hints drop the fake code and describe the kind of query instead ("a course code").
- **Page titles (S1):**
  - Course and chapter pages generate their titles from the data: "CODE Title", and "CODE · Chapter N: Title".
  - An unknown course or chapter keeps the not-found title.
  - The title is built by one pure helper.
- **Link previews and theme colour (S2):**
  - The root metadata gets Open Graph and Twitter card data: site name, description, one static generic preview image in
    the brand colours.
  - Course pages reuse their title.
  - A viewport export sets the theme colour for light and dark (the page backgrounds) and the colour scheme.
- **Pluralisation (S16):** the celebration texts (chapter finished, course finished) use the right singular or plural.
  Any other "N files" text built in code is checked too.
- **Skip link (S6):** in the site chrome, visually hidden until focused, targeting the main content. Every site page's
  main element gets the id it targets.
- **Text size (S8):** no text below 12px on student pages. Muted text on the tinted to-do columns is checked for 4.5:1
  contrast and adjusted if needed.
- **Ellipsis (S9):** every loading label uses the "…" character.
- **Email fields (S10):** no spellcheck and no autocapitalize. The existing email type and autocomplete stay.
- **Touch and overscroll (S17):**
  - One global rule gives links and buttons `touch-action: manipulation`.
  - The shared sheet and dialog components contain overscroll.
- **Reduced motion (S7):** the year card's hover lift runs only under `prefers-reduced-motion: no-preference`, and
  transitions list their properties.
- **Account pages (N7):** sign-up, check-email and confirm-email get the "Back to courses" link the sign-in page has.
- **FAQ (N1):** the "Do I need an account?" answer adds that Saved, To-do and Progress need one.
- **404 (N8):** the not-found page offers Back to home, Browse courses and Search.

Reader (S14):
- A full-width outline "Download PDF" button goes under "Mark as done" in the details column, which sits under the card on
  a phone.
- It uses the same download route as the menu item, so a download never marks a file as done.
- The menu keeps Download as well. "Open outside the reader" stays in the menu only.
- **Focus mode on a phone (N3):** an "Exit focus mode" button sits in the card's top row while focus mode is on. Desktop
  keeps Esc and the menu.

Course and chapter pages:
- **Phone back links (S3):** below md, the course page shows "‹ Second year" (the year crumb's label and address,
  `yearCrumb`) above the title, and the chapter page shows "‹ CODE" (to the course). They use the reader's existing back-link
  style. Desktop keeps the breadcrumbs. Lecturer filtering in the URL is kept as the breadcrumbs keep it.
- **Lecturer strip (S13):** from 5 lecturers up, the "Taught by" strip is one sideways-scrolling row of cards at every
  width. Below 5 it is unchanged.
- **Course tabs (N2):** tabs that scroll sideways get an edge fade.

Exams (S4):
- Below md, the five filters fold into one disclosure control, "Filters", with the number of active filters ("Filters (2)").
  It opens to the same five selects and Apply.
- It must work without JavaScript, for example a native details/summary. With JavaScript a change still submits at once.
- From md up nothing changes.
- The count of active filters comes from the parsed URL values through one pure helper. Unusable values are ignored, as
  today.
- `ResourceListItem` gains `courseTitle`, loaded in the same query as the rows (no extra query per row). The resource row
  shows "CODE Title" where it already shows the code (exam rows, search file rows). Course and chapter pages, where the
  course is obvious, do not repeat the title.
- The count line uses "·" instead of "-" ("117 exams · page 1 of 6").

Home (S5):
- Below md the order becomes: hero headline and buttons, "Choose your year", then the preview card, the numbers strip and
  the rest. This is a CSS order or grid change, not a second copy of the content. Desktop is unchanged.
- **Signed-in hint cookie:**
  - `ua_signed_in`, readable by scripts, value "1". It holds nothing personal and is not used for authorization.
  - It is set and cleared next to the session cookies: set wherever they are set (sign-in, refresh, restore), cleared
    wherever they are cleared (sign-out, failed refresh). It has the refresh cookie's lifetime and path `/`.
- Home stays static and never reads the session on the server.
- A tiny inline script, run before paint, reads the hint and marks the document as probably signed in. CSS then reserves
  the progress band's space at the top on a phone and shows the short hero (one line plus buttons).
- When `GET /api/v1/auth/me` answers signed out, the marker is removed and the visitor layout returns. When the progress
  band loads, it fills the reserved space.
- A visitor without the hint gets exactly today's static page and makes no new request.
- Reading the hint is one pure helper.
- The hint is documented in CLAUDE.md beside the auth cookies.

Year pages and Search (S11, N4):
- A course with zero visible files renders as a muted card, not a link, with "No files yet" in place of the resource count.
  This matches the empty Home year card.
- All course cards align their content to the top.
- Search course results with zero files use the same muted, non-link look.
- The search chips row gets an edge fade.

Saved (N5): long course titles in group headings are limited to two lines.

To-do board (S15): each column gets bottom padding on a phone, so the last card scrolls clear of the floating + button.

Admin (N9, N10):
- The admin resource list gets a "Search" text box: title or course code, contains, ignoring case.
- The search value lives in the URL with the other filters and is kept in paging links. An empty or overlong value is
  ignored.
- `listResources` takes it as `q`, still admin only.
- On a phone the admin tabs are one sideways-scrolling row, and Sign out leaves the tab row.

## Testing Decisions

What makes a good test here:
- A test checks behaviour a student or the admin can observe: page titles, visible text, what is a link, what is focusable,
  the order of sections, cookies set or cleared, the rows a query returns.
- It does not check class names or internal state.
- No test is weakened. Existing specs that assert old wording or layout are updated to the agreed behaviour.

Playwright is the main seam, extending the existing specs:
- **home:**
  - phone order for a visitor;
  - phone order for a signed-in student, with no layout shift measured as the year cards' position before and after the
    band loads;
  - a stale hint falls back to the visitor layout;
  - no DEMO code in the hero;
  - the skip link.
- **browse / year pages:** a course with no files is muted and not a link; the course and chapter pages' phone back links,
  with breadcrumbs still on desktop.
- **exams:**
  - the phone "Filters (N)" control opens, applies and counts;
  - it works with JavaScript disabled;
  - rows show the course title.
- **search:** no fake code in the hints; file rows show the course title; a 0-file course is not a link.
- **reader:** "Download PDF" downloads the file and does not mark it as done; the phone focus mode Exit button.
- **celebrations:** "1 file" wording.
- **todo-board:** the last card's Start button is clickable on a phone with the + button present.
- **taught-by:** 5 or more lecturers give one row.
- **auth / sign-in-page:**
  - `ua_signed_in` is set on sign-in and cleared on sign-out;
  - "Back to courses" on the sign-up and confirm pages;
  - email fields have spellcheck off.
- **admin-resources:** the search box filters and survives paging.
- **page titles:** course and chapter `<title>` values.
- **404:** the new links.

Vitest covers the pure helpers:
- the page-title builder;
- the pluralised celebration texts (extending the existing celebration tests);
- the active-filter count;
- reading the hint cookie.

Service tests:
- the resources service returns `courseTitle` on list items (exams, search);
- admin `listResources` with `q` (match on title and on code, case-insensitive, `%` and `_` taken literally, refused for
  a student).

Prior art: `home-progress.spec.ts` (signed-in Home band), `exams.spec.ts` (filters and no-JavaScript form),
`saved-reader.spec.ts` (reader details buttons), `auth.spec.ts` (cookies), the users admin search (`listUsers` with `q`),
and `year-card` and `celebrations` unit tests.

Runs use the e2e recipe: a fresh seeded throwaway database, local storage, its own port. Seeded courses with zero files
may be needed for the muted-card tests; any new seed data stays obviously fake.

## Out of Scope

- **S12**, the exams year grid on the desktop course page: rejected by the owner, 2026-11-23.
- A "continue reading" or recently opened list on Home. The reader's remembered page stays per file.
- Any change to the desktop Home order, the desktop breadcrumbs or the desktop Exams filters.
- Search inside PDFs, measured performance work, and screen-reader testing beyond labels and keyboard reachability.
- New content, real course data at build time, and AI features.

## Further Notes

- The audit's screenshots are in `~/ua-audit-152/screens/`, and the report cites them per finding.
- **Ticket split:** the quick batch (site-wide fixes plus the account, FAQ and 404 changes) splits into a few small
  tickets by area. Each layout change (Home, Exams, phone back links, reader Download and focus exit, muted course cards,
  the to-do padding and phone polish, admin search and tabs) gets its own ticket, so each PR stays small.
- The hint cookie is the one new mechanism. It must stay a hint: no page or API trusts it, and Home must look right
  without it.
- Target: before the partial exams, early December 2026.
