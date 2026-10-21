# Backend architecture

Status: decided 2026-10-11.

## Decision

The platform is one Next.js application with no separate Express backend. Next.js already contains the backend: route handlers under `src/app/api` are the HTTP API, and server-rendered pages run on the server. Business logic lives in framework-free service functions that sit between the entry points (pages and route handlers) and the Sequelize models. The website calls services directly. Read endpoints for a future mobile app are written when that app starts, not now.

## Layers

```
pages and route handlers  ->  services  ->  Sequelize models
```

| Layer | What it does |
| --- | --- |
| Pages and route handlers | Entry points. A route handler is the controller: it validates input, identifies the user, calls one service function, and turns the result or error into an HTTP response. Keep handlers thin, around twenty lines. There are no separate controller files. |
| Services | Hold all business rules, permission checks and database queries. This is the one place for logic, shared by pages, API routes and any future worker. |
| Models | Describe tables and associations only. |

There is no repository layer. Sequelize models already are the data-access layer, and with six tables a repository would only re-export `findAll` under another name. The exception: when a query is reused or grows past a few lines (search will likely be the first), move it into a named query function beside the model.

Models live in `src/db/models` and services in `src/services` (one folder per entity, with `schemas.ts`, `types.ts`, the service file and its tests; shared `viewer.ts`, `errors.ts` and `visibility.ts` at the top).

## Rules for services

These rules keep a future mobile API cheap.

- No Next.js or React imports. Never touch a request, response or cookie.
- Take plain arguments. Filters and paging are ordinary values.
- Validate their own arguments with the entity's zod schema (`schemas.ts`) and throw `ValidationError`, so a caller that skips validation never reaches the database with a bad value. Ranges come from `src/db/constants.ts`, which mirrors the check constraints.
- Lists that can grow are paged: they take `page` and `pageSize` and return a `Page<T>` with the total.
- Take the viewer (the signed-in user, or nobody) as an argument, so the caller decides whether it came from a cookie or a token.
- Return plain serialisable data with a named TypeScript type, never Sequelize model instances.
- Permission checks live in the service, not in the route handler, so a page and an API route can never enforce different rules.
- A handler may shape the same error differently per client. `GET /api/v1/resources/[id]/open` answers JSON errors (404/503/500) to API clients, but redirects a request that accepts `text/html` to the static `/resource-unavailable` page, so a browser never shows raw JSON.

Illustration of the pattern (not existing code):

```ts
export async function POST(req: Request) {
  const viewer = await getViewer(req);
  const input = parseBookmarkInput(await req.json());
  const result = await bookmarkResource(viewer, input);
  return Response.json(result);
}
```

## API endpoints: built now and later

Pages call services directly, so the website needs no read endpoints. Unused endpoints still have to be secured, tested and versioned, and designing a read contract without a real client is guessing. Read endpoints will be added as thin wrappers over the existing services when a mobile app actually starts, estimated at about a week of work then.

Endpoints the website itself needs are written now: sign-in, token refresh, sign-out, bookmarking, marking done, uploads, and requesting a signed download link. Public API routes go under `/api/v1/`.

Built so far: `POST /api/v1/auth/sign-in`, `/refresh` and `/sign-out`, plus `GET /api/v1/auth/restore`, which `/admin` redirects to when the access token has expired (it rotates the refresh cookie, then redirects to a validated same-site path). All are `no-store`, take tokens only from cookies, and reject requests whose `Origin` (or `Referer`) is not the app's own host. `GET /api/v1/auth/me` is the one read: the header account control calls it from the browser after a page has loaded. It returns `{ user: { name, role } | null, renewable }`, never an email or a token, changes nothing and so has no origin check. `renewable` says that the access cookie is missing or expired but a refresh cookie is present; the control then renews once through `/refresh`, holding a browser lock (Web Locks) so that several tabs never present the same refresh token, which would count as reuse and end the session. On `/admin` the control leaves renewing to the restore route. The auth services live in `src/services/auth/` and know nothing about cookies; cookie handling, the client IP and the origin check are in `src/lib/auth/`.

`getViewer()` (`src/lib/auth/viewer.ts`) reads the access cookie and returns the `Viewer`. `/admin`, the admin write routes below, `/api/v1/auth/me` and the open route (`/api/v1/resources/[id]/open`) call it. The open route confirms the account in the database and uses its current role, so an admin can open a draft; anonymous requests cost no extra query, and if the session cannot be read the request is treated as anonymous. Public pages keep passing `null`, so they carry no per-user data and drafts are never rendered outside the admin area. The refresh cookie is scoped to `/api/v1/auth`, so ordinary page requests never carry it.

`/admin` lists all resources, drafts included, for the signed-in admin: a read-only list (20 per page) with a course filter in the URL (`/admin?course=CODE&page=N`). It calls `listResources` with the admin viewer and renders only after the admin check passes. Each row links to the open route ("Open", in a new tab) when it has a link or a stored file (`hasSource`), and says "No file or link yet" otherwise.

The reader page (`/resources/[id]`, `src/app/resources/[id]`) reads one resource as an anonymous visitor through `getResourceForReader` (`src/services/resources/reader.ts`): the detail fields plus the course semester, the chapter position, whether the course has chapters, whether a file exists and the backup link. It never returns the storage key, and a draft, unknown or malformed id is not found. In the browser, a client component loaded with `next/dynamic` (`ssr: false`, so PDF.js is only in this page's bundle) fetches `/api/v1/resources/[id]/open` with `disableRange` and `disableStream`, so there is a single plain GET (no Range header, no CORS preflight; R2's policy allows GET from the site origin). The open route redirects to the short-lived signed URL. The PDF.js worker file is located with `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`, which Next.js copies to the build output. `GET /api/v1/resources/[id]/download` has the same visibility and error behaviour as the open route (shared in `src/app/api/v1/resources/route-helpers.ts`) but redirects to a signed URL with an attachment disposition and the filename `<title>.pdf` (through `safeFilename`). It works only for a stored file; a resource with only a link is a 404. Its answers are `Cache-Control: no-store`.

The admin creates and edits resources through a form at `/admin/resources/new` and `/admin/resources/[id]/edit` (linked from the list). Each page runs the shared server check in `src/app/admin/guard.ts`; the edit page loads the stored values with `getResourceForEdit`, which reports whether a file exists but never its key. The form's Chapter field (hidden for exams, reset when the course changes) is filled from `listChapterOptions` in `src/services/chapters/options.ts`, which both pages load on the server. For type "solution" the form shows a Solution of field (reset when the course changes) listing the chosen course's exercises and exams, drafts included, from `listSolutionTargets` in `src/services/resources/solution-targets.ts`, which both pages also load on the server. The form is a client component that calls the API below through `src/lib/admin-fetch.ts`, which renews an expired session once through `/api/v1/auth/refresh` and retries. The form is laid out as cards (what it is, where it belongs, the material) beside a side column with a Visibility choice (draft or published, which also names the save button), the Cancel and Delete actions and a live preview of how students will see the resource; the edit page header shows the stored status and last-saved date from `updatedAt`. The edit page also has a Delete button, in the Visibility card, that asks for confirmation (naming the stored title and noting when the resource is published or has solutions, which are kept and unlinked) and then calls the delete route; the new page has none.

The bulk upload page (`/admin/resources/bulk`, files in `src/app/admin/resources/bulk/`, linked from `/admin` with the course filter carried as `?course=CODE`, which also preselects the course) adds many resources to one course at once. It needs no endpoint of its own: each dropped PDF goes through the same upload steps as the form (`checkPdfFile` and `uploadPdf`, three at a time, at most 50 files per batch), and Save then calls `POST /api/v1/resources` once per uploaded row (three at a time) with the row's fields and `fileTicket`. `guessFromFileName` (`guess.ts`, pure and tested) fills each row's title, type, exam session and academic year from the file name, reusing the filter-word rules of `parseSearchQuery`; the admin edits every value, and description, backup link and "solution of" are left to the edit form. The whole batch is either drafts (the default) or published. Rows are independent: a saved row leaves the table, and a row the server refuses stays with its error (a refused file means uploading it again), with no rollback of the others.

The admin resource write services are exposed as `POST /api/v1/resources` (201 with `{ resource }`), `PUT /api/v1/resources/[id]` (200 with `{ resource }`, replacing all editable fields) and `DELETE /api/v1/resources/[id]` (204). All are `no-store` and check the same-origin rule first. The handlers are thin: the shared part (origin check, viewer, error mapping) is in `src/lib/resources-api.ts`, and the service validates the body and re-checks the admin role in the database. A request with no valid session is `401 Not signed in`; a signed-in user who is not an admin is `403 Forbidden`. Invalid input is `400` with the offending `fields`, and an unknown or malformed id is `404`.

Adding a file to a resource takes three steps. The browser asks `POST /api/v1/uploads` (admin only, body `{ size }`, 201) for an upload: a short-lived URL, method and headers to send the file to, and a ticket. It then `PUT`s the PDF straight to storage. Finally it saves the resource with `fileTicket` set to the ticket, on create or update. The ticket is a signed token (`src/lib/storage/upload-ticket.ts`, one hour, its own audience so it is never accepted as an access or storage token) that names the generated storage key, so the browser never chooses a key. When saving, the server verifies the ticket and inspects the stored object: it must exist, be within the size limit, have the PDF content type and begin like a PDF. An object that fails is deleted and the save is refused with `fields: ["file"]`; a key that already belongs to another resource is refused too. Saving without a ticket leaves the stored file untouched; replacing a file, or deleting the resource, removes the old object once the database change is committed (a failed removal is logged and does not fail the request). A file and a link may now coexist, with the file winning: `GET /api/v1/resources/[id]/open` redirects to a short-lived signed read URL for a stored file and to the link only when there is no file. A published resource needs a file (its stored one, or a new `fileTicket` in the same request); a link alone never satisfies this, and a draft may be saved without a file. The rule is also a database check (`resources_published_has_file_check`). The migration that introduced it turned every published resource without a file into a draft; undoing the migration does not republish them. An upload that is never saved leaves an abandoned object in storage; see "Abandoned uploads" below.

The admin resource form does these steps in the browser (`src/app/admin/resources/file-field.tsx`, helper `src/lib/upload-file.ts`). Choosing a PDF checks it locally (PDF type or `.pdf` name, 1 byte to 50 MB), asks `POST /api/v1/uploads` through `adminFetch`, and sends the bytes with `XMLHttpRequest` (fetch has no upload progress) using exactly the returned headers, so the file starts uploading at once and can be cancelled. The ticket is kept in the form and sent as `fileTicket` on save only when present; the save button reads "Uploading..." and is disabled meanwhile. The browser's own file name is never sent. If the save answers `fields: ["file"]` the ticket is dropped and the admin picks the file again.

The chapter write services are exposed the same way, through the same `adminWrite` helper, which answers a not-found error with the error's own message (`Resource not found`, `Course not found` or `Chapter not found`). Every success is `200` (`201` for create) with `{ chapters }`, the course's chapters in order: `POST /api/v1/courses/[courseId]/chapters` (201, body `{ title }`), `PUT /api/v1/courses/[courseId]/chapters/order` (200, body `{ chapterIds }`), `PUT /api/v1/chapters/[id]` (200, body `{ title }`) and `DELETE /api/v1/chapters/[id]` (200). `courseId` is the course's UUID, not its code. There is no GET route; server pages read through the service.

The admin chapters page (`/admin/chapters?course=CODE`) is the first screen to use these routes. The server page reads through `listChaptersWithCounts`, which returns each chapter with `itemCount`, the number of resources filed under it (drafts included); `listChapters` and the routes' `{ chapters }` shape are unchanged. The client list in `src/app/admin/chapters/` writes through `adminFetch`, then calls `router.refresh()` so the page re-renders with fresh chapters and counts instead of trusting the response body. Rows can also be dragged by their handle (pointer, touch or keyboard); a drop sends the same order request as the arrow buttons.

### Search

The Search page (`/search`) reads `searchCatalog(query, { type, show, page })` in `src/services/search/`. It takes no viewer: search is public, so it always sees what a student sees (published files only; a chapter only when it has a published file; every course). `query.ts` is pure and tested without a database; `search.ts` holds the SQL; `schemas.ts` and `types.ts` are as in the other services. Input is validated with Zod (at most 100 characters; a query under two characters, after trimming, is not an error but answers `state: "short"` so the page shows its hints).

- **Extension.** Migration `20261019130000-enable-unaccent.js` runs `CREATE EXTENSION IF NOT EXISTS unaccent` (its `down` drops it). It is the one migration that is not a table change. Postgres ships it as a contrib module and Neon allows it; the test database gets it from the same migrations (the Vitest global setup migrates it), and CI too. Its `down` runs `DROP EXTENSION IF EXISTS unaccent`, which drops the extension even if it was installed before this migration ran (and would fail, or need `CASCADE`, if something else already depends on it).
- **Matching.** Full-text search with the `simple` configuration (no stemming, no stop words) over `to_tsvector('simple', unaccent(lower(text)))`. The texts are: course code plus title; chapter title; file title (weight A) plus description (weight B). Every word of the query is a prefix (`word:*`) and all words are required, so "algo" finds "Algorithms" and "theorie" finds "Théorie". A course is also found when its code with spaces and accents removed starts with the query words joined ("demo 301" finds DEMO301).
- **Input is never SQL or tsquery syntax.** `parseSearchQuery` folds the text (lower case, accents removed, the same fold as the PDF reader's search, in `src/lib/text-fold.ts`) and keeps only runs of letters and digits as words (at most 12). The words are one bound array parameter (`$words`). The tsquery is assembled in SQL: each word goes through `unaccent()` first, anything that is tsquery or `LIKE` syntax is stripped from the result, and only then is it quoted as `'word':*` and joined with `&`. Quoting must come last: `unaccent('ŉ')` is `'n`, which would break out of the quotes if quoting came first. Every other value (types, sessions, year, limit, offset) is bound too. The query length is counted in characters (code points) by the one rule in `query.ts` (`searchLength` and `clipQuery`), used by the page and the Zod schema alike.
- **Filter words.** Words that name a type (exam, lecture, cours, notes, exercise, td, solution, corrigé and their plurals and French forms), an exam session (partial/partiel, final, second/rattrapage) or an academic year (`2024`, `2024-2025`, `2024/2025`) also filter files and are removed from the text. A session word counts as a filter only when the query also has a year or a type word, or when it is the only kind of word left; next to plain words ("partial derivatives", "second order equations") it is text. A session alone means exams. If no text is left, the filtered files are listed. The chips (`type=all|course|lecture|exercise|exam`) limit the sections and kinds of file; a chip and a type word must both hold. Solutions and "other" files appear only under All.
- **Ranking.** Courses: exact code, then title matches, then `ts_rank`, then code. Chapters: `ts_rank`, then title, course code and position. Files: title matches before description-only matches, then `ts_rank` (title words outweigh description words), then for exams the newest academic year, then title, course code and id.
- **Highlights** are computed in the page, not in SQL: `findPrefixRanges` (in `src/lib/text-fold.ts`) marks the start of each word that begins with a query word, on the same folding, and the page builds `<mark>` elements from the ranges (nothing is injected as HTML). A file whose title lacks some of the words gets a snippet of its description (about 120 characters around the first match). The database's `unaccent` folds a few letters (such as "ø") that JavaScript does not, so such a match can be found without being marked.
- **No indexes, on purpose.** The text vectors are computed while querying, because the catalogue is a few hundred rows. If it grows by orders of magnitude, add generated `tsvector` columns with GIN indexes on `resources`, `chapters` and `courses`, and a trigram or functional index for the code form. `unaccent()` is only STABLE, so a generated column or an expression index cannot call it directly: it needs an IMMUTABLE wrapper function (created by a migration, using `unaccent('unaccent', text)` with the dictionary named) first.
- **Paging.** Each section returns its top 5; `show=courses|chapters|files` returns that section alone, 20 to a page, with the page clamped to the last one.

The page itself never reads the session. The search box (`src/app/search/search-form.tsx`) is a plain GET form that works without JavaScript; with JavaScript it replaces the address 300 ms after the last keystroke (`router.replace`, no history entry) and the server page re-reads it.

Server pages must not call the app's own API over HTTP. If an endpoint must be proven to work, it gets an automated test that calls it over HTTP instead.

## File storage

Every resource will have one stored PDF. All code reaches files through one interface, `FileStorage` (`src/lib/storage/types.ts`), with two drivers chosen by `STORAGE_DRIVER`: a local folder (development, tests, CI, so none of them needs the cloud) and Cloudflare R2 (production). `getStorage()` builds the driver lazily, so importing it reads no environment and the build needs no storage configuration. Keys are generated (`resources/<uuid>.pdf`) and every driver rejects any key outside lower-case letters, digits, `-`, `_`, `.` and `/` before touching the disk.

Browsers upload straight to storage through a short-lived signed URL, because a Vercel function cannot receive a large request body; the server afterwards checks what arrived (size, and `looksLikePdf` on the first bytes). Files are read through short-lived signed URLs too.

The local driver imitates this with `PUT` and `GET /api/v1/storage/local?token=…`. They answer 404 unless the driver is `local`. The token is the whole authorisation (no cookies): a JWT signed with `AUTH_SECRET` under its own audience (`ua-storage`), so it is never accepted as an access token and vice versa. A `put` token carries the key, content type and size limit; a `get` token carries the key, disposition (inline or attachment) and filename. The upload is counted while streaming and refused with 413 over the limit, leaving nothing on disk.

### Cloudflare R2 driver

`src/lib/storage/r2.ts` implements the same interface against R2's S3 API with `aws4fetch` (a small SigV4 signer; the AWS SDK would be far more code for seven HTTP calls). It is chosen by `STORAGE_DRIVER=r2` (the default on Vercel) and needs four variables, checked lazily and reported by name only: `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (see `.env.example`). The endpoint is `https://<account id>.r2.cloudflarestorage.com`, path-style (`/<bucket>/<key>`), region `auto`. Server-side calls (`put`, `stat`, `readStart`, `delete`, `list`) are signed requests (`list` is ListObjectsV2, following continuation tokens); `createReadUrl` and `createUploadUrl` return query-signed (presigned) URLs. The read URL sets `response-content-disposition` and, for `.pdf` keys, `response-content-type`. The upload URL signs the `Content-Type` header, so R2 refuses an upload sent with another type. `readStart` reads a 206 answer to its end only when its declared length is at most the bytes asked for; otherwise it reads only those bytes and stops the download. It never awaits that stop, because inside Next.js awaiting `cancel()` on a response body hung until the socket timed out (about five minutes) and a save with a file took that long.

**Upload size is not enforced by R2.** A signed `PUT` URL cannot carry a maximum size, so `maxBytes` is ignored by this driver. The server-side check after the upload (size via `stat`, content via `readStart`) is what enforces size and content, and it must delete a file that fails it. Errors from the driver name the operation and the HTTP status only, never a key, a URL or a response body.

### Abandoned uploads

`FileStorage.list(prefix)` returns every object under a prefix (key, size, last-modified time). A stored object is abandoned when all three hold: its key matches exactly `resources/<lower-case uuid>.pdf` (the shape the app generates; any other key is never touched), it was last modified more than 24 hours ago (an upload ticket lasts one hour, so a save in progress is never at risk), and no row in `resources` has it as `file_key` (drafts included). The rules and constants live in `src/services/storage-cleanup/constants.ts`. `findAbandonedUploads(viewer)` lists `resources/` and applies them; `deleteAbandonedUploads(viewer, keys)` re-checks every rule from a fresh listing and a fresh query right before deleting, skips any key that changed since the scan (or that is not in the list at all), and never deletes a key the caller did not pass. Both are admin only. The admin page `/admin/storage` ("Scan storage" runs the scan on the server through `?scan=1`) shows the files and a confirmed "Delete N files" button that calls `POST /api/v1/storage/cleanup` (admin only, same-origin, body `{ keys }` of 1 to 500, answers `{ deleted, skipped }`). A scheduled cleanup is a separate, later task that will reuse the same service.

Bucket settings the owner applies in the Cloudflare dashboard (R2 → the bucket → Settings):

- Public access off: no `r2.dev` URL and no custom domain. Every read goes through a signed URL.
- A CORS policy so browsers can upload to and read from signed URLs. Replace `YOUR-DOMAIN` with the production domain:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://YOUR-DOMAIN"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

`npm run storage:check` exercises the driver against the real bucket (with `STORAGE_DRIVER=r2` and the four variables in `.env`): it uploads, reads, uploads through an upload URL, deletes and confirms, printing one line per step. Run it once after creating the bucket and the API token. It needs Node 22.18 or newer, which runs the TypeScript driver directly.

Demo files: the demo seeder (`SEED_DEMO_DATA=true`) gives every seeded resource that has a source a generated placeholder PDF (`src/lib/storage/sample-pdf.ts`, one A4 page marked "SAMPLE FILE"). The files are stored through the configured driver (`.storage` locally, R2 with `STORAGE_DRIVER=r2`) under generated keys, before the rows are inserted; if the insert fails they are removed again. Seeding again replaces them, and the seeder's `down` deletes them with the rows. The seeder loads the TypeScript storage code through `db/seeders/lib/storage.mjs`, so seeding needs Node 22.18 or newer.

## Email jobs

Outgoing email goes through a Postgres queue, the table `email_jobs` (kind, `to_email`, `payload` jsonb, status `pending | sent | failed`, attempts, `next_attempt_at`, short `last_error`, `sent_at`), so an email is never lost when a request ends or a provider is down. Code: `src/services/email-jobs/` (framework-free), `src/lib/mail/` (drivers), `src/lib/send-email-job-after-response.ts`.

**Rule: a payload never holds a secret** (no token, no password). A handler, registered per kind with `registerEmailHandler(kind, handler)`, builds `{ subject, text, html }` when the email is sent and creates any secret then. `last_error` is a short reason without the address or a token.

- **Enqueue:** `enqueueEmailJob({ kind, to, payload }, transaction)` must run inside the caller's transaction, so the job and, for example, the new user commit together. After the commit, call `sendEmailJobAfterResponse(id)`.
- **After the response:** that function schedules `processEmailJob(id)` with Next.js `after()` (route handlers and server actions; on Vercel it uses `waitUntil`, so the work is limited by the route's max duration). Errors are caught and logged without the address. If the work is cut short, the job simply stays pending.
- **Processing:** `processEmailJob` claims the job with one atomic `UPDATE ... SET attempts = attempts + 1 WHERE id = $1 AND status = 'pending' AND next_attempt_at <= now() RETURNING ...`, which also moves `next_attempt_at` 10 minutes ahead (a lease), so two runners never send the same job and a runner that dies mid-send is retried after the lease. A failure keeps it pending and pushes `next_attempt_at` by 1 min, 5 min, 30 min, 2 h, 12 h; the 6th failure marks it `failed`. An unknown kind fails at once ("unknown kind"). With mail not configured the attempt fails and the job stays pending (nothing is built, no secret is minted).
- **Daily sweep:** `GET /api/cron/email-jobs` (Vercel Cron, `vercel.json`, `0 3 * * *`, the most Hobby allows) runs `processDueEmailJobs` (due pending jobs, oldest first, 50 at a time) and deletes `sent` jobs older than 30 days and `failed` ones older than 90, because they hold addresses. It needs `Authorization: Bearer ${CRON_SECRET}`: 401 otherwise, 503 with no work when `CRON_SECRET` is unset. The answer is JSON counts, `no-store`.
- **Drivers** (`MAIL_DRIVER`): `log` (default off Vercel; appends one JSON line per email to `MAIL_LOG_FILE`, which tests read to find links, or prints only the recipient and subject) and `brevo` (`POST https://api.brevo.com/v3/smtp/email` with `api-key`, needs `BREVO_API_KEY` and `MAIL_FROM`, optional `MAIL_FROM_NAME`, 10 s timeout; errors name the HTTP status only). On Vercel with no `MAIL_DRIVER`, mail is "not configured" and every attempt fails and is retried later; `log` is refused on Vercel so confirmation links never reach the logs. Configuration is read lazily, so the build needs nothing.
- **Why not BullMQ or another queue:** Vercel has no always-on worker to run one, and a table plus `after()` and a daily sweep needs no extra service.

## Error tracking

Production errors, on the server and in the browser, go to Sentry (free plan), because Vercel Hobby keeps runtime logs for about an hour. Errors only: no tracing, session replay, profiling or logs product. Nothing is enabled unless a DSN is set, so dev, tests, CI and the build send nothing and need no Sentry variables.

- **Server and edge:** `src/instrumentation.ts` initialises the SDK in `register()` when `SENTRY_DSN` is set (the SDK is imported dynamically, so it is not loaded otherwise) and exports `onRequestError`, which Next.js calls for unhandled errors in pages, route handlers and actions. `NotFoundError` and `ValidationError` never get that far: pages turn them into the 404 page (`readForPage`) and handlers into 404/400 answers. Services keep logging with `console.error`.
- **Browser:** `src/instrumentation-client.ts` does not import the SDK statically (it would join the first-load bundle). When `NEXT_PUBLIC_SENTRY_DSN` is set it waits for `requestIdleCallback` (or 2 seconds), then imports `@sentry/nextjs` dynamically and initialises it. Until then tiny `error` / `unhandledrejection` listeners keep at most 10 errors in `src/lib/monitoring/queue.ts`, which are sent once, after init. `src/app/error.tsx` and `src/app/global-error.tsx` call `reportError` (`src/lib/monitoring/report.ts`), which uses the same queue; it is a no-op without the DSN.
- **Scrubbing:** `src/lib/monitoring/scrub.ts` (pure, unit-tested) is the `beforeSend` and `beforeBreadcrumb` of all three runtimes (shared through `options.ts`, with `sendDefaultPii: false`). It removes `event.user`, request cookies, the headers `cookie`, `set-cookie`, `authorization`, `x-forwarded-for`, `x-real-ip` (and a few similar address headers), and the query parameters `token` and `ticket` (local storage URLs, upload tickets) from the request URL, the query string and breadcrumb URLs. The route, browser, OS and stack stay. In the Sentry project settings, also turn on "Prevent Storing of IP Addresses".
- **Tunnel:** `withSentryConfig` (in `next.config.ts`, imported from `@sentry/nextjs/config`) adds a rewrite from `/monitoring` to Sentry's ingest host, so browser reports go through our own domain and ad blockers do not drop them. Nothing else matches that path.
- **Source maps:** uploaded at build time only when `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` are set, then deleted from the output so they are never served. Without them the build uploads nothing and prints nothing. The release is the commit SHA (Vercel's `VERCEL_GIT_COMMIT_SHA`); the environment comes from `VERCEL_ENV` (`NEXT_PUBLIC_VERCEL_ENV` in the browser).
- **Admin link:** `SENTRY_ISSUES_URL` (server-only) shows an "Errors" link in the admin bar; there is no errors page in the app.
- **Variables** (all optional, in `.env.example`; production sets them in Vercel): `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_ISSUES_URL`.

## Alternatives considered

- **Separate Express backend.** Rejected for now. It means two deployables, a second host, cross-origin setup and an endpoint for every screen, and it solves a problem (many independent clients) the project does not have yet.
- **Controllers and repositories as extra layers.** Rejected. Route handlers already act as controllers, and models already act as repositories. Four layers for a solo developer with six tables adds files without adding separation.
- **Pages calling the app's own API over HTTP.** Considered so that endpoints would exist and be exercised, then rejected. It adds a needless network hop, starts two server functions per page view on Vercel, requires forwarding the visitor's cookies by hand, can fail at build time, and loses type safety.

## When to revisit

Reconsider a separate backend if:

- the mobile app becomes the main product,
- other developers join and the backend needs separate ownership and deployment, or
- the product needs long-lived connections such as real-time chat.

Because the logic lives in framework-free services, moving later means rewriting only the thin handlers. Slow background work, for example processing PDFs for AI features, will need a separate worker regardless of this decision. It would import the same services and models.
