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

The admin creates and edits resources through a form at `/admin/resources/new` and `/admin/resources/[id]/edit` (linked from the list). Each page runs the shared server check in `src/app/admin/guard.ts`; the edit page loads the stored values with `getResourceForEdit`, which reports whether a file exists but never its key. The form is a client component that calls the API below through `src/lib/admin-fetch.ts`, which renews an expired session once through `/api/v1/auth/refresh` and retries. Choosing which resource a solution answers and deleting are not in the form yet; an existing solution link is kept while the type stays "solution".

The admin resource write services are exposed as `POST /api/v1/resources` (201 with `{ resource }`), `PUT /api/v1/resources/[id]` (200 with `{ resource }`, replacing all editable fields) and `DELETE /api/v1/resources/[id]` (204). All are `no-store` and check the same-origin rule first. The handlers are thin: the shared part (origin check, viewer, error mapping) is in `src/lib/resources-api.ts`, and the service validates the body and re-checks the admin role in the database. A request with no valid session is `401 Not signed in`; a signed-in user who is not an admin is `403 Forbidden`. Invalid input is `400` with the offending `fields`, and an unknown or malformed id is `404`.

Server pages must not call the app's own API over HTTP. If an endpoint must be proven to work, it gets an automated test that calls it over HTTP instead.

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
