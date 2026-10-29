import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { readForPage } from "@/lib/page-errors";
import { listUsers, type UserListItem } from "@/services/users/users";
import type { Viewer } from "@/services/viewer";
import { parseUsersParams, usersHref } from "./params";

const DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Beirut", day: "numeric", month: "short", year: "numeric" });
const formatDate = (iso: string) => DATE.format(new Date(iso));

const ROLE_LABELS = { admin: "Admin", student: "Student" } as const;

function StatusBadge({ user }: { user: UserListItem }) {
  return user.emailConfirmedAt ? (
    <Badge variant="outline">Confirmed</Badge>
  ) : (
    <Badge variant="secondary">Unconfirmed</Badge>
  );
}

const Dash = () => (
  <span className="text-muted-foreground">
    <span aria-hidden>-</span>
    <span className="sr-only">No name</span>
  </span>
);

// Read-only list of accounts. Rendered only after the admin check.
export async function UserList({ viewer, raw }: { viewer: Viewer; raw: Record<string, string | string[] | undefined> }) {
  const params = parseUsersParams(raw);
  const result = await readForPage(() =>
    listUsers(viewer, { q: params.q, unconfirmed: params.status === "unconfirmed", page: params.page }),
  );
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const previous = params.page > 1 ? usersHref({ ...params, page: params.page - 1 }) : null;
  const next = params.page < pages ? usersHref({ ...params, page: params.page + 1 }) : null;
  const filtered = params.q !== undefined || params.status !== undefined;

  return (
    <section className="space-y-5" aria-label="Users">
      <h2 className="text-lg font-semibold text-heading" aria-live="polite">
        {result.total} {result.total === 1 ? "user" : "users"}
        {pages > 1 && <span className="text-sm font-normal text-muted-foreground"> - page {result.page} of {pages}</span>}
      </h2>

      <form action="/admin/users" method="get" className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <label htmlFor="admin-users-q" className="mb-1.5 block text-sm font-medium text-heading">Email</label>
          <Input
            id="admin-users-q"
            name="q"
            type="search"
            defaultValue={params.q ?? ""}
            placeholder="Part of an email address"
            autoComplete="off"
            className="h-11 md:h-9"
          />
        </div>
        {/* A checkbox, not a select: unchecked it adds nothing to the address. */}
        <label htmlFor="admin-users-status" className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium text-heading md:min-h-9">
          <input id="admin-users-status" type="checkbox" name="status" value="unconfirmed" defaultChecked={params.status === "unconfirmed"} className="size-4 accent-primary" />
          Unconfirmed only
        </label>
        <Button type="submit" className="h-11 px-4 md:h-9 md:px-3">Search</Button>
      </form>

      {result.items.length === 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <p>No users match.</p>
          {filtered && (
            <Link href="/admin/users" className="mt-2 inline-flex min-h-11 items-center text-link underline underline-offset-4 md:min-h-0">
              Clear the search
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {/* Visual column labels only; each row's own text already says what it is. */}
            <div aria-hidden className="hidden gap-x-4 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_5rem_7rem_7rem_7rem]">
              <span>Email</span>
              <span>Name</span>
              <span>Role</span>
              <span>Signed up</span>
              <span>Status</span>
              <span>Last active</span>
            </div>
            <ul className="space-y-2">
              {result.items.map((u) => (
                <li
                  key={u.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,2.5fr)_minmax(0,1.5fr)_5rem_7rem_7rem_7rem] md:gap-y-0 md:py-3"
                >
                  <p className="min-w-0 break-all font-medium text-heading md:col-start-1 md:row-start-1">{u.email}</p>
                  <div className="justify-self-end md:col-start-5 md:row-start-1 md:justify-self-start">
                    <StatusBadge user={u} />
                  </div>
                  <p className="col-span-2 text-sm md:col-span-1 md:col-start-2 md:row-start-1">
                    {u.name ?? <Dash />}
                    <span className="md:hidden">
                      {" · "}
                      {ROLE_LABELS[u.role]}
                    </span>
                  </p>
                  <p className="hidden text-sm md:col-start-3 md:row-start-1 md:block">{ROLE_LABELS[u.role]}</p>
                  <p className="col-span-2 text-sm md:col-span-1 md:col-start-4 md:row-start-1">
                    <span className="md:hidden">Signed up </span>
                    {formatDate(u.createdAt)}
                  </p>
                  <p className="col-span-2 text-sm md:col-span-1 md:col-start-6 md:row-start-1">
                    <span className="md:hidden">Last active </span>
                    {u.lastActiveAt ? formatDate(u.lastActiveAt) : "Never"}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          {pages > 1 && (
            <Pagination aria-label="User pages">
              <PaginationContent>
                {previous && (
                  <PaginationItem>
                    <PaginationPrevious href={previous} className="min-h-11" />
                  </PaginationItem>
                )}
                <PaginationItem className="px-3 text-sm text-muted-foreground">
                  Page {result.page} of {pages}
                </PaginationItem>
                {next && (
                  <PaginationItem>
                    <PaginationNext href={next} className="min-h-11" />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </section>
  );
}
