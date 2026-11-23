# Pre-launch UI/UX audit (#152)

Audit date: 2026-11-23. Branch `docs/ui-ux-audit-152` (docs only: nothing in the product changed).

This is the report the ticket asks for. It is a list of findings for the owner to review. **No layout change in
it is agreed or built**: every proposed layout change has a text mockup and waits for the owner's go-ahead (see
"Agree UX before building"). Agreed findings then go through `/grill-with-docs`, `/to-spec`, `/to-tickets`.

## How the audit was done

- A throwaway database (migrated, seeded with the demo data, then topped up with obviously fake extra data:
  23 more DEMO courses across all four years, a course with 12 chapters and 63 files, long course, chapter and
  file titles, six lecturers, exams over six academic years and three sessions, Master 1 courses) and the production build
  on a private port, local storage driver. About 340 full-page and viewport screenshots were taken with Playwright:
  phone 390x844, desktop 1280x800 (1440 for Home, a year page and a course page), light and dark, signed out and signed in as the demo
  student, plus Slow 3G (400 ms latency, 400 kbit/s) for Home, a course, the reader, Exams and Search.
- Screenshots live outside the repo, in `~/ua-audit-152/screens/` (names `<page>-<state>-<out|in>-<phone|desktop|wide>-<light|dark>.png`;
  `out` = signed out, `in` = signed in). Findings cite them by name; where the name ends `-<viewport>-<theme>` only the
  phone-light or desktop-light one is cited, the other three variants exist too.
- Each finding is marked **[screen]** (seen in a screenshot) or **[code]** (read from code or HTML, not
  judged on screen). The Web Interface Guidelines review (Part 2) is code only: appendix A.
- Not captured, see the last section.

## Summary

Overall the platform is in good shape: the design system is consistent, dark mode is clean, the reader, the to-do
board, the progress page, the celebrations and the in-page sign-in states all look finished, and nothing overflows
sideways on a phone. The problems are concentrated in a few places.

Counts: **2 launch blockers, 10 should fix, 16 nice to have** (28 findings).

Top of the list:

1. **Favicon is still the default Next.js "N"** (B1). Every tab, bookmark and history entry shows it.
2. **Fake demo text is hard-coded into production pages** (B2): the Home hero preview ("DEMO310 / Sample Full Course A"
   and fake exams) and Search's hints ("Try a course code, like DEMO301"). Real courses use codes like I3305.
3. **Course and chapter pages are all titled just "Course" / "Chapter"** (S1) and there is **no social preview** (S2), although
   students will share course links in chat groups.
4. **On a phone, course and chapter pages have no way up** except the browser Back button (S3); and **Exams** spends the
   whole first screen on five dropdowns and shows course codes without names (S4).
5. **Home on a phone** puts "Choose your year" about 1,300 px down and gives a returning student the same
   marketing page as a visitor (S5).

Severity: **launch blocker** = would look broken or wrong on launch day; **should fix** = clear friction or
inconsistency worth a ticket before or soon after launch; **nice to have** = polish.

---

## Site-wide

### B1. Favicon is the default Next.js logo - launch blocker [screen: `favicon-current.png`]
`src/app/favicon.ico` is the framework's black circle with an "N" (unchanged since the first commit). It is the only
branding in the browser chrome, and it looks like an unfinished template.
Why: first impression, recognisability among many open tabs.
Fix: a simple "UA" / book mark in the primary blue (`#3E4EB8`), as `favicon.ico` plus `icon.svg` and `apple-icon.png`
(Next metadata files). Also delete the unused default SVGs in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) [code].

### B2. Fake demo text hard-coded in public pages - launch blocker [screen: `home-out-phone-light.png`, `search-empty-out-phone-light.png`; code `src/app/(site)/home/hero.tsx:63`, `src/app/(site)/search/results.tsx:36,348`]
The Home hero's "What a course looks like" card is fixed text: "DEMO310", "Sample Full Course A", "Sample partial exam 2024".
Search's empty state says "Try a course code (**DEMO301**) ...", and the no-results tips say "like DEMO301". With real material live
(codes like I3305) these point at things that do not exist; the hero card reads as leftover placeholder.
Why: looks unfinished, and the search hint sends the student to a dead query.
Fix: use a clearly generic but real-looking sample in the hero (or take one real course's data at build time), and in Search use
an example that exists (a real code, or "a course code" with no example).

### S1. Course and chapter pages have the generic titles "Course" and "Chapter" - should fix [code + HTML: `curl /courses/DEMO321` gives `<title>Course | University Assistant</title>`; `src/app/(site)/courses/[code]/page.tsx:14`, `.../chapters/[position]/page.tsx:17`]
Year pages and the reader have specific titles; the two pages students open most do not. Ten open tabs, the history list,
bookmarks and search-engine results are all "Course | University Assistant".
Fix: `generateMetadata` giving "DEMO321 Distributed Systems" and "DEMO321 · Chapter 3: Title".

### S2. No social preview and no theme colour - should fix [code: `src/app/layout.tsx` has only title and description]
No `openGraph`, no `twitter`, no preview image, no `viewport.themeColor`. A course link pasted in a WhatsApp or Telegram
group shows a bare URL or a title with no image; the phone's browser bar stays white or black instead of matching the page.
Fix: `openGraph` (site name, description, one generic image) in the root metadata, per-course title/description from S1,
and `themeColor` for light (`#F5F5F5`) and dark.

### S6. No "skip to content" link - nice to have [code: `src/components/site/site-chrome.tsx`]
Keyboard users tab through the logo and six nav items on every page before the content.
Fix: a visually hidden skip link that appears on focus, targeting `<main id="main">`.

### S7. Hover lift on year cards ignores reduced motion; `transition-all` - nice to have [code: `src/app/(site)/home/stats-and-years.tsx:70`]
`transition-all group-hover:-translate-y-0.5` runs for everyone. Fix: list the properties and gate the movement with `motion-safe:`.

### S8. Small text - nice to have [code: `todo-card.tsx:140,266,286`, `card-view-dialog.tsx:254`, `reader-card.tsx:728` use `text-[11px]`; `todo-board.tsx:494` 10px]
11 px muted text ("Added 2 minutes ago", note counter) on a phone. `--muted-foreground` `#6b6b6b` on `#F5F5F5` is about 4.9:1, but on the
tinted to-do columns it drops towards 4.5:1 or below [not measured]. Fix: 12 px minimum, and check the muted token on the column tints.

### S9. Loading labels use three dots - nice to have [code: `sign-up-form.tsx:136`, `confirm-email.tsx:56`, `sign-in-fields.tsx:186`]
"Creating account...", "Confirming your email...", "Signing in..." versus the single "…" used elsewhere ("Saving…"). Fix: use "…".

### S10. Email fields allow spellcheck - nice to have [code: `sign-in-fields.tsx:139`, `sign-up-form.tsx:87`, `resend-link.tsx:49`]
Mobile keyboards underline and auto-correct addresses. Fix: `spellCheck={false}` (and `autoCapitalize="none"`).

### S17. No touch and overscroll polish - should fix [code: `src/app/globals.css`, `src/components/ui/sheet.tsx`, `dialog.tsx`]
No `touch-action: manipulation` on buttons and links (iOS double-tap delay on every tap in a study session), and no `overscroll-behavior: contain` on the phone
sidebar, bottom sheets and dialogs (the page behind scrolls when the sheet's end is reached). Fix: one global rule for the first, a class on the shared sheet/dialog for the second.

### Slow connection [screen: `slow3g-*`]
Slow 3G (400 ms latency, 400 kbit/s): Home was complete after about 7.4 s, the others after 4.5 s. What I saw:
- Home paints nothing for the first second (`slow3g-home-t800-phone-light.png` is a blank grey page) and then arrives at once; the page is static HTML (about 32 KB
  uncompressed) so the wait is mostly latency. Nothing to fix cheaply; do not add heavy images or fonts to Home.
- Course, Exams and Search show a skeleton inside the site frame (`slow3g-course-t800-phone-light.png`) and keep the same layout when filled in: good.
- The reader shows its frame, the title and a "Loading the file…" placeholder of the final size (`slow3g-reader-t2000-phone-light.png`), so there is no layout shift: good.
- No layout shift was visible on Home when the signed-in progress band appears (it is reserved or below the fold).

### Decided, not findings
English only; yellow used only as the title bar; palette and sentence-case headings and buttons (the guidelines ask for Title Case, the product
uses sentence case everywhere); no "Sign up" in the header; Done green only for finished; no AI panel yet.

---

## Home

### S5. Phone: the year cards are far down, and a returning student sees the marketing page - should fix [screen: `home-out-phone-light.png`, `home-in-phone-light.png`, `home-in-desktop-light.png`]
On a phone the hero (headline, text, two buttons, three facts, then the whole "What a course looks like" card) fills about 1,300 px before the numbers
strip and "Choose your year"; the real goal (pick a year) is the third screen. Signed in, the "Your progress" band comes after the hero, so a student
who wants to continue sees the same sales page as a visitor. There is also no "continue where you left off": the reader remembers the page, but nothing
lists the last opened files.
Why: lazy student, taps to the common goals (a course's lecture is Home → year → course → chapter → file = 5 taps).
Proposed (needs the owner's go-ahead):

```
Phone, before                    Phone, after (visitor)          Phone, after (signed in)
[hero: headline]                 [hero: headline, 2 buttons]     [Your progress: 3 courses, See all]
[text, 2 buttons, facts]         [Choose your year: 4 cards]     [Choose your year: 4 cards]
[course preview card]  <- 600px  [course preview card]           [hero shrinks to one line + buttons]
[stats strip]                    [stats strip]
[Choose your year]  <- ~1300px   ...
```
Options: move "Choose your year" above the preview card on phone only (CSS order), and for a signed-in student put the progress band first.
Also the preview card's tab labels are cut on a phone ("Previous ex…", "Other mater…") [screen `home-out-phone-light.png`]: use "Exams" / "Other" on narrow widths or let the tabs scroll.

### N1. FAQ: only the first answer is open, "Do I need an account?" omits that Saved, To-do and Progress need one - nice to have [screen: `home-out-desktop-light.png`; copy in `home/sections.tsx:47`]
Fix: one more sentence in that answer.

---

## Year pages

### S11. Courses with no files look the same as real ones; card content is vertically centred - should fix [screen: `year2-out-phone-light.png`, `yearm1-out-desktop-light.png`]
A course card with "0 resources" is as prominent as a course with 63 and leads to an empty page. In the two-column desktop grid the code chip sits at different heights in
neighbouring cards (centre alignment, see DEMO721 vs DEMO722 in `yearm1-out-desktop-light.png`). On a phone a year is a single column of 12 cards (about 1,800 px).
Fix: top-align the card content; show a muted "No files yet" (still a link, or not a link like the Home year card) for a course with none; consider two columns from 360 px wide cards or a denser list on a phone.

---

## Course page

### S3. No way up on a phone - should fix [screen: `course-chapters-out-phone-light.png`, `chapter-out-phone-light.png`; compare `reader-out-phone-light.png` which has a back link]
Breadcrumbs are desktop only. On a phone the course page shows just the title and code (no year or semester), and the chapter page "Chapter 3 · DEMO321" is text, not a link;
the only link up is "All chapters" at the very bottom of the chapter. The reader does have a back link, so the three pages are inconsistent.
Proposed (needs go-ahead): the reader's back-link pattern on both.

```
Course (phone)                         Chapter (phone)
before                after            before                    after
[title]               [< Second year]  [Chapter title]           [< DEMO321]
[DEMO321]             [title]          [Chapter 3 · DEMO321]     [Chapter title]
                      [DEMO321 · Sem 1]                          [Chapter 3 of 12]
```

### S12. Desktop exam list is a column of very wide, sparse rows - nice to have [screen: `course-exams-out-desktop-light.png`]
18 exams are 18 rows each as wide as the window (1,200 px) with the content in the left third and the bookmark at the far right. Hard to scan across, long page.
Fix (a layout change, needs go-ahead): group by academic year with the three sessions as three columns (Partial | Final | Second), each a compact tile, solution link inside the tile.

```
2025-2026
[Partial  ][Final    ][Second  ]    one row per academic year instead of three
 sample...  sample...  sample...
```

### S13. "Taught by" strip with 6 lecturers takes two rows before any content - nice to have [screen: `course-exams-out-desktop-light.png`; long name is truncated "Dr. Grace Longname-Placehold…"]
Fix: single scrolling row from 5 lecturers up, or a select. The truncation of very long names is acceptable.

### N2. Tabs on a course without chapters scroll sideways with the last tab cut ("Exams 18") and no hint - nice to have [screen: `course-nochapters-out-phone-light.png`]
Fix: fade at the right edge, or `scroll-snap` and a visible half-tab (already near that), or wrap into two rows.

---

## Chapter page
Covered by S3 (no way up on phone). Long chapter and file titles wrap cleanly [screen: `chapter-out-phone-light.png`]. Previous / All chapters / Next stack well.

---

## Reader

### S14. Download is hidden two taps deep - should fix [screen: `reader-out-desktop-light.png`, `reader-menu-out-desktop-light.png`, `reader-menu-out-phone-light.png`]
The details column has Save, Add to to-do and Mark as done, but Download and "Open outside the reader" exist only inside the "..." menu. Downloading a lecture to read offline is
one of the main reasons students come (the product rule: "browsing and downloading"), and on a phone the menu is a sheet that must be opened first.
Proposed (needs go-ahead):

```
Desktop details column                    Phone (under the card)
before            after                   before               after
[Save for later]  [Save for later]        [Save for later]     [Save for later]
[Add to to-do]    [Add to to-do]          [Add to to-do]       [Add to to-do]
[Mark as done]    [Mark as done]          [Mark as done]       [Mark as done]
                  [Download PDF]                               [Download PDF]
```
(Open outside the reader can stay in the menu.)

### N3. Focus mode on a phone has no visible exit - nice to have [screen: `reader-focus-out-phone-light.png`]
Only Esc (no keyboard on a phone) or the "..." menu item "Exit focus mode" leaves it; nothing on screen says so. Fix: a small "Exit" / minimise button in the top row while in focus mode.

### Good
Search bar, highlights, contents sheet (`reader-search-out-phone-light.png`, `reader-contents-out-phone-light.png`), the phone floating bar, the sign-in dialog from Save (`signin-dialog-out-phone-light.png`) and the
done/progress line all look finished. The Contents sheet shows only thumbnails for a file without an outline: fine.

---

## Exams

### S4. Phone: five dropdowns fill the first screen; rows show codes but not course names - should fix [screen: `exams-out-phone-light.png`, `exams-out-desktop-light.png`]
Before the first result a phone shows about 480 px of filters (five stacked selects plus Apply), and every row identifies its course by code only ("DEMO521"). A student remembers
"Algorithms", not the code. Lecturer lines make rows vary in height. There is no "clear filters" shortcut and the count line reads "117 exams - page 1 of 6" (hyphen).
Proposed (needs go-ahead):

```
Phone, before                    Phone, after
Previous exams                   Previous exams
[Semester v]                     [Filters (2)  v]   <- collapsed, shows active count
[Course v]                       117 exams
[Academic year v]                [DEMO521 Algorithms  >]
[Session v]                        Final · 2025-2026 · EN
[Lecturer v]                     ...
[Apply]
117 exams ...
[DEMO521 Sample ...]
```
Course title shown beside (or under) the code in every exam row, here and in Search.

---

## Search

### N4. Course results include courses with 0 files, and the chips scroll off the right - nice to have [screen: `search-results-out-phone-light.png`]
"DEMO122 ... 0 files" is a dead end. The chip row is cut at the right edge ("Exercise…") with no hint (it does scroll). Fix: hide or mute empty courses in results; fade the chip row's edge.
Search empty, hints, results and no-results states are otherwise clear and well worded [screen: `search-empty-out-phone-light.png`, `search-none-out-phone-light.png`].

---

## Saved

### N5. A long course title makes the group heading huge - nice to have [screen: `saved-filled-in-phone-light.png`]
Short titles sit on the code line; a long one wraps at full 24 px heading size and pushes the group down. Fix: clamp the title to two lines at 18 px or put the title on its own muted line like the year/semester text.
Otherwise good: done circle, bookmark and "Add to to-do" are all 44 px targets; empty state is clear.

---

## To-do board

### S15. Phone: the round `+` button covers the right-hand "Start" button of the card underneath - should fix [screen: `todo-board-in-phone-light.png`, `todo-board-in-phone-dark.png`]
The floating button overlaps the last visible card's Start button while scrolling the board (the full-page screenshot shows it over a card; with a long column this happens on every screen).
Fix: stop the card column's right padding short of the button, or move "Add a card" into the tab bar row; or accept and add `pb-24` so the end of the list can clear it. [verified on screen only at one scroll position]

### N6. Empty-column text is small and low-contrast on the tinted columns - nice to have [screen: `todo-in-desktop-light.png`]
See S8. Everything else on the board (composer, card view, file picker, filters, menu) is consistent with the rest of the site [screen: `todo-cardview-in-phone-light.png`, `todo-filepicker-in-phone-light.png`].

---

## Progress and celebrations

### S16. "1 files done" in the chapter-finished toast - should fix [screen: `celebrate-chapter-in-phone-light.png`]
"Chapter topic number 1, all 1 files done." A chapter with a single counted file is common in the real data (and the course-finished dialog says "all 5 files" correctly, but would say "1 files" for a one-file course).
Fix: pluralise ("all 1 file done" -> "its 1 file is done").

### Good
Progress page, "This week", milestones, rings, the course-finished dialog and confetti, milestone toast, year-page rings all render cleanly in both themes
[screen: `progress-in-phone-light.png`, `progress-in-phone-dark.png`, `celebrate-course-in-phone-light.png`]. The milestone row scrolls sideways on a phone with the next item cut off (a deliberate hint).

---

## Account pages and sign-in states

### N7. Sign-up and confirm pages on a phone have no link back to the site - nice to have [screen: `signup-out-phone-light.png`, `confirm-none-out-phone-light.png`]
Only the brand text links home; the sign-in page has "Back to courses". Fix: add the same link under the form on sign-up, check-email and confirm-email.

Sign-in desktop split, sign-in dialog, in-page signed-out states ("Sign in to see your progress") look finished [screen: `signin-out-desktop-light.png`, `progress-signedout-out-phone-light.png`].

---

## 404 and errors

### N8. 404 offers only "Back to home" - nice to have [screen: `notfound-out-phone-light.png`]
Tone is fine. A student who mistyped a course code would like "Browse courses" and "Search" beside it. A course page that does not exist (`/courses/NOPE999`) shows the same message [screen: `notfound-course-out-phone-light.png`]; mentioning the code would help.

---

## Header, phone sidebar, footer

Header, hamburger sidebar (`sidebar-out-phone-light.png`), account menu, theme toggle and footer are consistent and meet the 44 px target on a phone. Keyboard Tab shows a visible
focus ring [screen: `keyboard-tab-home-out-phone-light.png`].
Only nit: the account menu holds just the name and "Sign out" [screen: `account-menu-in-phone-light.png`], which is as designed.

---

## Admin (light pass) [screen: `admin-admin-desktop-light.png`, `admin-admin-phone-light.png`, other `admin-*`]

### N9. The resource list has no text search and 21 pages of 20 - nice to have
With the real ~400+ files, finding one by title means paging; only Course, Lecturer and the scanned filter exist. Fix: a title/code search box (the Search service exists).

### N10. Phone: the six admin tabs wrap to two rows and "Sign out" sits among them - nice to have [screen: `admin-admin-phone-light.png`]
Usable; consistent with the site. Fix: horizontal scroll row.

Admin pages are usable and consistent with the public look. Not polished by design.

---

## Counts

- Launch blocker (2): B1 favicon, B2 fake demo text.
- Should fix (10): S1 page titles, S2 social preview and theme colour, S3 phone back navigation, S4 Exams phone filters and course names, S5 Home phone order,
  S11 year cards, S14 Download in the reader, S15 `+` button over cards, S16 "1 files", S17 touch and overscroll behaviour (code only).
- Nice to have (16): S6, S7, S8, S9, S10, S12, S13, N1, N2, N3, N4, N5, N7, N8, N9, N10 (N6 is part of S8).

---

## Appendix A. Web Interface Guidelines review (code only)

Rules skipped because CLAUDE.md decided otherwise: English only, palette, sentence-case headings and buttons (the guideline says Title Case), the
"decided, not a finding" list above. Tags in brackets point to the finding above.

```
## src/app/layout.tsx
src/app/layout.tsx:16 - metadata has no openGraph/twitter (S2)
src/app/layout.tsx:- - no `viewport` export: no themeColor, no colorScheme (S2)

## src/app/(site)/courses/[code]/page.tsx
src/app/(site)/courses/[code]/page.tsx:14 - static title "Course" (S1)

## src/app/(site)/courses/[code]/chapters/[position]/page.tsx
src/app/(site)/courses/[code]/chapters/[position]/page.tsx:17 - static title "Chapter" (S1)

## src/components/site/site-chrome.tsx
src/components/site/site-chrome.tsx:12 - no skip link before the header nav (S6)

## src/app/(site)/home/hero.tsx
src/app/(site)/home/hero.tsx:63 - hard-coded DEMO310 / "Sample Full Course A" (B2)
src/app/(site)/home/hero.tsx:- - preview tab labels truncate on phone (S5)

## src/app/(site)/home/stats-and-years.tsx
src/app/(site)/home/stats-and-years.tsx:70 - transition-all → list properties; hover translate not behind motion-safe (S7)

## src/app/(site)/search/results.tsx
src/app/(site)/search/results.tsx:36 - hard-coded DEMO301 example (B2)
src/app/(site)/search/results.tsx:348 - hard-coded DEMO301 example (B2)

## src/app/(auth)/sign-up/sign-up-form.tsx
src/app/(auth)/sign-up/sign-up-form.tsx:136 - "Creating account..." → "…"
src/app/(auth)/sign-up/sign-up-form.tsx:87 - email input missing spellCheck={false}

## src/app/(auth)/confirm-email/confirm-email.tsx
src/app/(auth)/confirm-email/confirm-email.tsx:56 - "Confirming your email..." → "…"

## src/components/auth/sign-in-fields.tsx
src/components/auth/sign-in-fields.tsx:186 - "Signing in..." → "…"
src/components/auth/sign-in-fields.tsx:139 - email input missing spellCheck={false}; autoComplete="username" fine
src/components/auth/sign-in-fields.tsx:143,159 - inputs disabled while pending (guideline: keep enabled until submit; low impact)

## src/components/auth/resend-link.tsx
src/components/auth/resend-link.tsx:49 - email input missing spellCheck={false}

## src/app/(site)/todo/card-composer.tsx
src/app/(site)/todo/card-composer.tsx:46 - autoFocus: fine on open-by-tap, but on phone it raises the keyboard at once (acceptable, user-initiated)

## src/app/(site)/todo/card-view-dialog.tsx
src/app/(site)/todo/card-view-dialog.tsx:301 - autoFocus on the destructive "Delete card" confirm button; focus Cancel instead
src/app/(site)/todo/card-view-dialog.tsx:254 - text-[11px] (S8)

## src/app/(site)/todo/todo-card.tsx
src/app/(site)/todo/todo-card.tsx:140,266,286 - text-[11px] (S8)

## src/app/(site)/todo/todo-board.tsx
src/app/(site)/todo/todo-board.tsx:494 - text-[10px] kbd hint (decorative, aria-hidden)

## src/app/(site)/resources/[id]/reader-card.tsx
src/app/(site)/resources/[id]/reader-card.tsx:728 - text-[11px] section label
src/app/(site)/resources/[id]/reader-card.tsx:- - Download / open-outside only inside the menu (S14)

## src/app/(site)/resources/[id]/reader-thumbnail.tsx, reader-contents.tsx, reader-menu.tsx
reader-thumbnail.tsx:83, reader-contents.tsx:70, reader-menu.tsx:81 - outline-none paired with focus-visible ring: pass

## src/app/globals.css
src/app/globals.css:- - no `touch-action: manipulation` on buttons/links (double-tap zoom delay on iOS) (S17)
src/app/globals.css:- - no `-webkit-tap-highlight-color` set intentionally
src/app/globals.css:192 - `color-scheme: only light` is inside PDF.js's text-layer rules (correct there); the document root sets no color-scheme (S2)

## src/components/ui/sheet.tsx, dialog.tsx
- no overscroll-behavior: contain on the phone sidebar, bottom sheets and dialogs (S17)

## public/
public/file.svg, globe.svg, next.svg, vercel.svg, window.svg - unused template files (B1)

## Passes
- Icon-only buttons have aria-labels (save, add to to-do, reader toolbar, hamburger, theme).
- Form fields have labels, names, correct types and autocomplete on the account pages.
- Decorative icons are aria-hidden; toasts use Sonner's live region; destructive actions have Undo or confirmation.
- Filters, tabs, pages and lecturer choice live in the URL; links are <a>/<Link>.
- Heading anchors have scroll-mt (years page, chapter groups, Home #years).
- dvh/svh used instead of vh for full-screen layouts; reduced motion honoured in globals.css.
- No `user-scalable=no`, no onPaste blocking, no div onClick.
- Dates: only relative "Added 2 hours ago" text and server-formatted dates; no hard-coded locale formats found in student pages.
```

---

## What was not captured

- Real PDFs: the seeded sample PDF has one page, so multi-page reader behaviour (outline in Contents, page jumps, fit page on long files, "Continue where you left off") and a scanned file were not exercised.
- Celebrations and the first "Mark as done" toast were captured once (phone, light, signed in); the same steps in the other themes and on desktop failed because the files were already marked by the first run (`celebrate-*` exist only for phone-light).
- Contrast was judged by eye and from tokens, not measured with a tool.
- Real mail, Brevo, the real course list and any real content; Master 1 is fake data.
- The confirm-email success state (needs a real token) and the check-email page after a real sign-up (the screenshot shows the no-stored-address variant).
- Production performance: only a throttled local production build was measured.
- Drag and drop on the board, the Contents panel remembered state, and screen reader output were not tested.
