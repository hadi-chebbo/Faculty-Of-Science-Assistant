import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { getViewer } from "@/lib/auth/viewer";
import { getAccount } from "@/services/auth/auth";
import { ForbiddenError } from "@/services/errors";
import { requireAdmin } from "@/services/viewer";
import { ResourceList } from "./resource-list";
import { SignOutButton } from "./sign-out-button";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

// Signed-in admin home: a read-only list of all resources. The page never ships until the viewer is checked on
// the server; there is no shared static shell with per-user data. Uncached (see next.config.ts).
export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <PageTitle>Admin</PageTitle>
      <Suspense fallback={<Skeleton className="h-16 w-full max-w-sm" />}>
        {searchParams.then((raw) => (
          <AdminContent raw={raw} />
        ))}
      </Suspense>
    </main>
  );
}

async function AdminContent({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const viewer = await getViewer();
  // No valid access token (never signed in, or it expired): the restore route either renews the
  // session from the refresh cookie and returns here, or sends the visitor to /sign-in.
  const account = await getAccount(viewer);
  if (!account) redirect("/api/v1/auth/restore?next=/admin");

  const admin = { id: account.id, role: account.role };

  // Checked against the current role in the database, not the token's (up to 15 minutes old).
  try {
    requireAdmin(admin);
  } catch (error) {
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="space-y-4">
      <p>
        Signed in as <strong>{account.email}</strong>
      </p>
      <SignOutButton />
      <ResourceList viewer={admin} raw={raw} />
    </div>
  );
}
