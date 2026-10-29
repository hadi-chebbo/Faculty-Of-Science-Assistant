import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "../guard";
import { UserList } from "./user-list";

export const metadata: Metadata = { title: "Users", robots: { index: false, follow: false } };

// Admin only, checked on the server before anything renders. Uncached (see next.config.ts).
export default function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-11 w-full max-w-sm md:h-9" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>}>
        {searchParams.then((raw) => (
          <UsersContent raw={raw} />
        ))}
      </Suspense>
    </main>
  );
}

async function UsersContent({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const { admin } = await requireAdminPage("/admin/users");

  return (
    <>
      <AdminBar current="users" />
      <PageTitle>Users</PageTitle>
      <UserList viewer={admin} raw={raw} />
    </>
  );
}
