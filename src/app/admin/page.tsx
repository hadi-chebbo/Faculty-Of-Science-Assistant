import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "./guard";
import { ResourceList } from "./resource-list";

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
  const { admin } = await requireAdminPage("/admin");

  return (
    <>
      <AdminBar />
      <ResourceList viewer={admin} raw={raw} />
    </>
  );
}
