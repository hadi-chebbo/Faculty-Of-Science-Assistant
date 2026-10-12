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
