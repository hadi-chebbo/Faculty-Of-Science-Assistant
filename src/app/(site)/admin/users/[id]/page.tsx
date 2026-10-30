import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { getUserDetail, type UserDetail } from "@/services/users/users";
import { requireAdminPage } from "../../guard";
import { formatDate, formatDateTime } from "../format";
import { parseUsersParams, usersHref } from "../params";
import { BlockButton } from "./block-button";
import { ConfirmEmailButton } from "./confirm-email-button";
import { DeleteAccountButton } from "./delete-account-button";

export const metadata: Metadata = { title: "User", robots: { index: false, follow: false } };

const ROLE_LABELS = { admin: "Admin", student: "Student" } as const;

// Admin only, checked on the server before anything renders. Uncached (see next.config.ts).
export default function AdminUserPage({ params, searchParams }: PageProps<"/admin/users/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-40 w-full max-w-xl" />
        </div>}>
        {Promise.all([params, searchParams]).then(([{ id }, raw]) => (
          <UserContent id={id} raw={raw} />
        ))}
      </Suspense>
    </main>
  );
}

async function UserContent({ id, raw }: { id: string; raw: Record<string, string | string[] | undefined> }) {
  const { admin } = await requireAdminPage(`/admin/users/${encodeURIComponent(id)}`);
  const user = await readForPage(() => getUserDetail(admin, id));
  // Only the list's own params are carried back, rebuilt from the parsed values, never a given address.
  const back = usersHref(parseUsersParams(raw));

  return (
    <>
      <AdminBar current="users" />
      <Link href={back} className="mb-3 inline-flex min-h-11 items-center text-sm text-link underline-offset-4 hover:underline md:min-h-0">
        &lsaquo; Users
      </Link>
      <PageTitle>
        <span className="break-all">{user.email}</span>
      </PageTitle>

      <div className="max-w-xl space-y-8">
        <Account user={user} />
        <Actions user={user} />
        <Activity user={user} />
        <Security user={user} />
        {user.role === "student" && <DeleteAccount user={user} backHref={back} />}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `user-${title.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Rows({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="divide-y rounded-lg border bg-card">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 px-4 py-2.5 text-sm">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words text-heading">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Account({ user }: { user: UserDetail }) {
  return (
    <Section title="Account">
      <Rows
        rows={[
          ["Name", user.name ?? <span className="text-muted-foreground">No name</span>],
          ["Role", ROLE_LABELS[user.role]],
          ["Signed up", formatDate(user.createdAt)],
          [
            "Email",
            user.emailConfirmedAt ? `Confirmed ${formatDate(user.emailConfirmedAt)}` : <Badge variant="secondary">Unconfirmed</Badge>,
          ],
          [
            "Status",
            user.blockedAt ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge variant="destructive">Blocked</Badge>
                {formatDate(user.blockedAt)}
              </span>
            ) : (
              "Active"
            ),
          ],
          ["Last active", user.lastActiveAt ? formatDate(user.lastActiveAt) : "Never"],
        ]}
      />
    </Section>
  );
}

// Nothing is shown when no action applies. An admin account cannot be blocked.
function Actions({ user }: { user: UserDetail }) {
  const canBlock = user.role === "student";
  if (user.emailConfirmedAt && !canBlock) return null;
  return (
    <Section title="Actions">
      <div className="flex flex-wrap gap-2">
        {!user.emailConfirmedAt && <ConfirmEmailButton userId={user.id} />}
        {canBlock && <BlockButton userId={user.id} email={user.email} blocked={user.blockedAt !== null} />}
      </div>
    </Section>
  );
}

function Activity({ user }: { user: UserDetail }) {
  const { counts } = user;
  return (
    <Section title="Activity">
      <Rows
        rows={[
          ["Saved resources", counts.saved],
          ["To-do cards", counts.cards],
          ["Completions", counts.completions],
          ["Milestones", counts.milestones],
          ["Active days", counts.activeDays],
        ]}
      />
    </Section>
  );
}

function Security({ user }: { user: UserDetail }) {
  const { failedSignIns } = user;
  return (
    <Section title="Security">
      <Rows
        rows={[
          ["Open sessions", user.sessions],
          [
            "Failed sign-ins",
            failedSignIns.latestAt
              ? `${failedSignIns.count} in the last 7 days, latest ${formatDateTime(failedSignIns.latestAt)}`
              : "None in the last 7 days",
          ],
        ]}
      />
    </Section>
  );
}

// Students only: an admin account cannot be deleted.
function DeleteAccount({ user, backHref }: { user: UserDetail; backHref: string }) {
  return (
    <Section title="Danger zone">
      <div className="space-y-3 rounded-lg border border-destructive/40 bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Deletes the account and everything that belongs to it: saved files, to-do cards, progress and sessions. This
          can&apos;t be undone.
        </p>
        <DeleteAccountButton userId={user.id} email={user.email} backHref={backHref} />
      </div>
    </Section>
  );
}
