# Dependencies

This file lists every package in `package.json`: what it is, why the project has it, where it is used, and which version is installed. It also lists problems found and packages that are planned but not installed yet.

CLAUDE.md says "No new dependency without a stated reason". This file is where the reason is kept.

**Keep it current.** When you add or remove a dependency, update this file in the same commit. Versions below are the ones in `package-lock.json` on 2026-10-12, updated 2026-10-20 for the dependency security fixes (review item 6). To check that each package has exactly one table row, run:

```bash
node -e "const p=require('./package.json');const rows=require('fs').readFileSync('docs/dependencies.md','utf8').split('\n').filter(l=>l.startsWith('| \`')).map(l=>l.split('|')[1].trim().replace(/\`/g,''));for(const k of Object.keys({...p.dependencies,...p.devDependencies}))if(rows.filter(n=>n===k).length!==1)console.log('check',k)"
```

It prints nothing when the file is complete. Terms: "runtime" means the app needs it when it runs; "dev" means it is only needed to build, test, lint or run tools. "Declared" is the range in `package.json`; "installed" is what the lockfile pins.

## Node version

`engines.node` is `>=22`, matching CLAUDE.md ("Node 22+") and the README. CI runs Node 24 (`.github/workflows/ci.yml`). There is no `.nvmrc`.

## Framework and React runtime

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `next` | The React framework: routing, server rendering, build. | CLAUDE.md: one Next.js app, App Router, no separate backend. | `src/app/**` (pages, route handlers), `next.config.ts`, `next/font/google` in `src/app/layout.tsx`. | `16.4.0` / 16.4.0 | Yes, runtime |
| `react` | The UI library. | Required by Next. | Every `.tsx` file under `src/`. | `19.3.0` / 19.3.0 | Yes, runtime |
| `react-dom` | Lets React draw into a browser page. | Required by Next as a peer dependency. | Not imported by our code; Next loads it. | `19.3.0` / 19.3.0 | Yes, runtime |

`next`, `react` and `react-dom` are pinned to exact versions (no `^`). The other runtime packages use `^` ranges.

## Styling and components

shadcn/ui is not a package you import. Its CLI copies component source files into `src/components/ui` (currently alert-dialog, badge, breadcrumb, button, card, dropdown-menu, progress, skeleton, sonner, tabs). `components.json` tells the CLI the style (`radix-vega`), the CSS file (`src/app/globals.css`) and the aliases (`@/components/ui`, `@/lib/utils`). Add a component with `npx shadcn@latest add <name>`, as CLAUDE.md requires. The copied files import the packages in this section.

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `tailwindcss` | Utility-class CSS framework (v4). | CLAUDE.md: Tailwind CSS. | `@import "tailwindcss"` in `src/app/globals.css`. Build time only. | `^4` / 4.3.3 | Yes, dev (only produces CSS at build time) |
| `@tailwindcss/turbopack` | A loader that runs Tailwind on CSS files when Next builds with Turbopack. | Needed to process Tailwind v4 under Turbopack. Specific reason not recorded. | `next.config.ts` (`turbopack.rules["*.css"]`). | `^4` / 4.3.3 | Yes, dev (build step) |
| `tw-animate-css` | CSS classes for animations used by shadcn components. | Added with the shadcn setup (commit 00d48ea). | `@import "tw-animate-css"` in `src/app/globals.css`. No JavaScript import. | `^1.4.0` / 1.4.0 | Yes, dev (build-time CSS only; moved from `dependencies` on 2026-10-20, review item 4) |
| `shadcn` | The shadcn/ui CLI, which also ships a stylesheet. | Added with the shadcn setup (commit 00d48ea). | `@import "shadcn/tailwind.css"` in `src/app/globals.css`; the `shadcn` command for adding components. | `^4.21.4` / 4.21.4 | Yes, dev (build-time import and CLI; moved from `dependencies` on 2026-10-20, review item 3) |
| `radix-ui` | Unstyled accessible UI building blocks (tabs, slot and others). | The shadcn `radix-vega` style builds on it. | `src/components/ui/{tabs,breadcrumb,badge,button,dropdown-menu,progress}.tsx`. | `^1.7.0` / 1.7.0 | Yes, runtime |
| `class-variance-authority` | Helper that picks CSS class sets from named variants (for example button size). | Used by the shadcn components. | `src/components/ui/{tabs,badge,button}.tsx`. | `^0.7.1` / 0.7.1 | Yes, runtime |
| `cn` | A small library that merges class names and resolves Tailwind conflicts. Its description: "Drop-in replacement for clsx + tailwind-merge". It comes from the `shadcn-ui/cn` repository. | Added by the shadcn setup (commit 00d48ea). It supplies the `cn()` function. | `src/lib/utils.ts` re-exports it. `src/components/ui/{badge,card,breadcrumb,tabs,skeleton,button}.tsx` import it directly from `"cn"`. | `^0.4.0` / 0.4.0 | Yes, runtime. It is used. See review item 1. |
| `lucide-react` | A set of SVG icons as React components. | `components.json` sets `iconLibrary: lucide`. | `src/app/(site)/page.tsx`, `src/app/(site)/courses/[code]/resource-tabs.tsx`, `src/components/ui/breadcrumb.tsx`, `src/components/site/{theme-toggle,nav-items}.tsx`. | `^1.55.0` / 1.55.0 | Yes, runtime |
| `@dnd-kit/core` | Drag and drop engine for React: pointer, touch and keyboard sensors, screen-reader announcements. | Touch dragging, keyboard dragging and announcements are hard to get right by hand, and native HTML5 drag and drop does not work on phones. Used for reordering chapters. | `src/app/(site)/admin/chapters/chapter-list.tsx`. | `^6.3.1` / 6.3.1 | Yes, runtime |
| `@dnd-kit/sortable` | Sortable-list layer on top of `@dnd-kit/core` (item hook, keyboard coordinates, list strategy). | Same reason as `@dnd-kit/core`. | `src/app/(site)/admin/chapters/{chapter-list,sortable-chapter-item}.tsx`. | `^10.0.0` / 10.0.0 | Yes, runtime |
| `@dnd-kit/utilities` | Small helpers for dnd-kit, such as turning a transform into a CSS string. | Same reason as `@dnd-kit/core`; peer-level helper of `@dnd-kit/sortable`. | `src/app/(site)/admin/chapters/sortable-chapter-item.tsx`. | `^3.2.2` / 3.2.2 | Yes, runtime |
| `next-themes` | Switches between light and dark mode and remembers the choice. | Added with the light/dark palette (commit cedc1e7). | `src/app/layout.tsx`, `src/components/site/theme-toggle.tsx`. | `^0.4.6` / 0.4.6 | Yes, runtime |
| `sonner` | Small toast notifications (a short message that fades by itself, optionally with an Undo button). | The shadcn `sonner` component builds on it. The save controls say "Saved. Find it under Saved in your account menu."; the to-do board will need toasts with Undo. | `src/components/ui/sonner.tsx` (mounted in `src/components/site/site-chrome.tsx`), `src/lib/saved-client.ts`. | `^2.0.8` / 2.0.8 | Yes, runtime |

## File storage

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `aws4fetch` | A tiny signer for the S3 request-signing scheme (SigV4) that works with `fetch`. No dependencies of its own. | The Cloudflare R2 driver needs six plain HTTP calls and presigned URLs. The AWS SDK would be two large packages for that; Cloudflare's own R2 documentation uses this library for signed URLs. | `src/lib/storage/r2.ts`. | `^1.0.20` / 1.0.20 | Yes, runtime |
| `pdfjs-dist` | Mozilla's PDF.js: draws a PDF onto canvases in the browser and gives access to its text and pages. | The reader page shows files inside our own page. The owner chose PDF.js because Android Chrome cannot show embedded PDFs, and the AI assistant planned after launch needs the text and page of what the student is reading. Loaded only on the reader page (dynamic import, no server rendering). | `src/app/(site)/resources/[id]/pdf-viewer.tsx`. | `6.4.299` (exact) / 6.4.299 | Yes, runtime |

## Database

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `sequelize` | An ORM: lets code read and write database tables as JavaScript models. | CLAUDE.md: Sequelize 6, owner's choice over Drizzle. | `src/db/sequelize.ts`, `src/db/models/*.ts`, `src/services/**` (courses, resources, visibility). | `^6.37.8` / 6.37.8 | Yes, runtime |
| `pg` | The PostgreSQL driver for Node. | Sequelize needs a driver for Postgres. | `src/db/sequelize.ts`; `scripts/prepare-test-db.mjs`. | `^8.23.1` / 8.23.1 | Yes, runtime |
| `pg-hstore` | Converts JSON to and from Postgres `hstore` text. | Sequelize's Postgres dialect needs it. No code of ours imports it. | Loaded by Sequelize itself. | `^2.3.4` / 2.3.4 | Yes, runtime |
| `sequelize-cli` | Command line tool that runs migrations and seeders. | CLAUDE.md: committed sequelize-cli migrations in `db/migrations`. | `package.json` scripts `db:*`; configured by `.sequelizerc` and `db/config.js`; `scripts/prepare-test-db.mjs` loads it. Not imported by the app. | `^6.6.5` / 6.6.5 | Yes, dev |
| `@types/pg` | TypeScript type definitions for `pg`. | Type checking of `src/db/sequelize.ts` and `scripts`. | `tsc` only. | `^8.23.1` / 8.23.1 | Yes, dev |

Why `pg` is passed explicitly: `src/db/sequelize.ts` sets `dialectModule: pg`. Sequelize normally loads the driver with a dynamic `require`, which breaks when Next bundles the code. Handing it the imported module avoids that (the comment in the file says so).

Why `sequelize`, `pg` and `pg-hstore` are in `serverExternalPackages` (`next.config.ts`): they are left out of the Next bundle and loaded from `node_modules`. The comment in the config says that when bundled, each route got its own copy of Sequelize, and a connection made by one route could not be used by the models of another (error "hasMany called with something that's not a subclass of Sequelize.Model"). `pg-hstore` is listed because Sequelize loads it, so it should come from the same place.

## Validation and security

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `zod` | Checks that data has the expected shape and gives typed results. | CLAUDE.md: Zod for validating all external input. | `src/lib/env.ts`, `src/services/validation.ts`, `src/services/courses/schemas.ts`, `src/services/resources/schemas.ts`. | `^4.6.5` / 4.6.5 | Yes, runtime |
| `jose` | Signs and verifies JWTs (HS256) with Web Crypto. | CLAUDE.md: access tokens are HS256 JWTs signed with `jose`, the one auth dependency; also signs upload tickets. | `src/services/auth/access-token.ts` (access tokens); `src/lib/storage/{token,upload-ticket}.ts` (storage tokens and upload tickets). | `^6.2.12` / 6.2.12 | Yes, runtime |
| `@node-rs/argon2` | Password hashing with Argon2 (native code). | The users table stores a password hash and the seeders create hashes. No note records why Argon2 was chosen. | `db/seeders/20261011111938-demo-student.js`, `db/seeders/20261011111939-admin-user.js` (hashing); `src/db/seeders.test.ts` (verifying); `src/services/auth/auth.ts` (checking passwords at sign-in). | `^2.2.2` / 2.2.2 | Yes, runtime |
| `@sentry/nextjs` | Sentry's SDK for Next.js: records and groups errors, with a build plugin for source maps and a tunnel route. | Error tracking in production: Vercel Hobby keeps runtime logs for about an hour, so errors would vanish. Errors only (no tracing, replay or profiling), nothing personal, enabled only when a DSN is set, and loaded lazily in the browser. | `next.config.ts` (`withSentryConfig`, from `@sentry/nextjs/config`), `src/instrumentation.ts` (server and edge), `src/instrumentation-client.ts` (browser, dynamic import), `src/lib/monitoring/*`. | `^11` / 11.8.0 | Yes, runtime |

## Testing

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `vitest` | Test runner for unit and integration tests. | CLAUDE.md: Vitest. | `vitest.config.mts`, `vitest.global-setup.mts`, `src/**/*.test.ts`; `npm test`. | `^5.0.3` / 5.0.3 | Yes, dev |
| `@playwright/test` | Browser test runner for the main user journeys. | CLAUDE.md: Playwright. | `playwright.config.ts`, `e2e/*.spec.ts`; `npm run test:e2e`; CI installs Chromium. | `^1.64.0` / 1.64.0 | Yes, dev |

## Tooling and types

| Package | What it is | Why we have it | Where used | Declared / installed | Section OK? |
|---|---|---|---|---|---|
| `typescript` | The TypeScript compiler. | CLAUDE.md: TypeScript strict. | `tsconfig.json`; `npm run typecheck`. | `^5` / 5.9.3 | Yes, dev |
| `@types/node` | Type definitions for Node APIs. | CLAUDE.md: "`@types/node` is kept at 24". | `tsc` only. | `^24.19.1` / 24.19.1 | Yes, dev |
| `@types/react` | Type definitions for React. | Type checking of `.tsx`. | `tsc` only. | `^19` / 19.3.0 | Yes, dev |
| `@types/react-dom` | Type definitions for React DOM. | Type checking of `.tsx`. | `tsc` only. | `^19` / 19.3.0 | Yes, dev |
| `eslint` | Finds code problems and style errors. | Standard Next.js setup; reason not recorded beyond that. | `eslint.config.mjs`; `npm run lint`. | `^9` / 9.39.5 | Yes, dev |
| `eslint-config-next` | The Next.js rule set for ESLint. | Same. | Imported in `eslint.config.mjs` (`core-web-vitals`, `typescript`). | `16.4.0` / 16.4.0 | Yes, dev |

Why `@types/node` is `^24` while `engines.node` is `>=22`: CLAUDE.md says to keep it at 24, and CI runs Node 24. The types would not warn if code used a Node API that is newer than 22.

## Planned, not yet installed

Taken only from `CLAUDE.md` and `docs/`. None of these are in `package.json` on `main`.

| Planned | Source | Note |
|---|---|---|
| An S3-compatible client for Cloudflare R2 (upload, short-lived signed URLs) | CLAUDE.md Stack (object storage, signed URLs, hosting on Cloudflare R2); `docs/backend-architecture.md` (uploads, signed download link) | No package is named in the docs. Choose one when the upload slice starts and record the reason here. |

Refresh tokens need no extra package: CLAUDE.md says they are stored as SHA-256 hashes, which Node's built-in `crypto` can compute.

## Things to review

Each item says what was found, how it was checked, and a suggested action. Nothing was changed.

1. **`cn` looks odd but is used and legitimate.**
   - Found: npm package `cn@0.4.0`. Its `node_modules/cn/package.json` says "Fast, small, compiled class-name merging for Tailwind CSS. Drop-in replacement for clsx + tailwind-merge", repository `shadcn-ui/cn`, no dependencies of its own.
   - Checked: a search finds `from "cn"` in `src/lib/utils.ts` and six files in `src/components/ui`. Added by commit 00d48ea (shadcn setup).
   - Action: keep. Note that `src/lib/utils.ts` only re-exports it, while the UI files import `"cn"` directly instead of `@/lib/utils`. Decide whether you want one import style.
2. **`clsx` and `tailwind-merge` are not in `package.json`.**
   - Found: no file in `src/` imports either. `clsx@2.1.1` is installed only as a dependency of `class-variance-authority` (`npm ls clsx`). `tailwind-merge` is not installed.
   - Risk: `clsx` and `tailwind-merge` are the usual choice for `cn()`, so code copied from elsewhere may import them. If a component or your code imports `clsx` later, it would work only by accident through the transitive copy.
   - Action: nothing now, because `cn` replaces them. If you add code that imports `clsx`, add it explicitly.
3. **`shadcn` is a runtime dependency but is a build-time and CLI tool.**
   - Found: the only use is `@import "shadcn/tailwind.css"` in `src/app/globals.css`, resolved at build. Nothing in `src/` imports it as JavaScript.
   - It is the source of the `braces` audit finding (item 6).
   - Done 2026-10-20: `shadcn` and `tw-animate-css` moved to `devDependencies`, ranges unchanged. `npm run build` and the e2e tests were run afterwards. Vercel installs dev dependencies for the build.
4. **`tw-animate-css` is CSS-only.** Imported once in `src/app/globals.css`, like `tailwindcss`, which is dev. Done 2026-10-20: moved to `devDependencies` together with `shadcn` (item 3).
5. **Other runtime and dev placement.** No other misplacement found. `react-dom` has no direct import but Next needs it. `@node-rs/argon2` is used by sign-in (`src/services/auth/auth.ts`), so `dependencies` is right (checked 2026-10-20).
6. **`npm audit`** (first run on a fresh `npm ci` with no fix applied; fixed 2026-10-20).
   - Before: `npm audit --omit=dev` 9 vulnerabilities (2 moderate, 7 high); `npm audit` 11 (2 moderate, 9 high).
   - After (2026-10-20): `npm audit --omit=dev` reports 0. `npm audit` reports 9 high, all the `braces` chain below.
   - `uuid <11.1.1` (moderate, missing buffer bounds check in v3/v5/v6 when `buf` is provided, GHSA-w5hq-g745-h8pq), reached only through `sequelize`. npm's suggested fix (downgrade Sequelize to 3.30.0) is wrong and was not applied. Fixed with an `overrides` entry in `package.json` scoped to Sequelize: `"overrides": { "sequelize": { "uuid": "^11.1.1" } }`, which installs uuid 11.1.1. Sequelize only calls `uuid.v1` and `uuid.v4` (`sequelize/lib/utils.js`) and never passes `buf`, so the advisory was not reachable and the override is defence in depth. Both functions were checked to work against uuid 11 from CommonJS. Remove the override when Sequelize 6 ships its own uuid >= 11.1.1.
   - `braces` (high, stack exhaustion on deeply nested patterns, GHSA-vfj7-8cjw-p6xm), reached through `micromatch`, `fast-glob`, then `shadcn` (via `@shadcn/registry` and `ts-morph`) and `eslint-config-next`. **Accepted.** No patched `braces` exists (3.0.3 is the latest); npm's suggested fixes downgrade `shadcn` and `eslint-config-next` to old majors and were not applied. Reasons: it is dev tooling only (not in `--omit=dev`, not in the deployed app), and it is reachable only through glob patterns we write ourselves. Re-check with `npm audit` before launch.
   - Never run `npm audit fix --force`.
7. **Duplicates.** No true duplicate. `cn` overlaps in purpose with `clsx` + `tailwind-merge`, but those are not direct dependencies (items 1 and 2). `eslint-config-next` and `shadcn` each pull a separate copy of `fast-glob` (3.3.1 and 3.3.3), which is harmless.
8. **Reasons not recorded** in CLAUDE.md or commit messages for `@tailwindcss/turbopack`, `eslint`, `eslint-config-next`, and the choice of Argon2. Action: add a sentence here if you remember one.
