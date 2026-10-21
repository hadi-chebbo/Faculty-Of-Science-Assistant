import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { findAbandonedUploads } from "@/services/storage-cleanup/cleanup";
import type { AbandonedUploads } from "@/services/storage-cleanup/types";
import { requireAdminPage } from "../guard";
import { AbandonedList } from "./abandoned-list";
import { formatAge, formatBytes, shortenKey } from "./format";

export const metadata: Metadata = { title: "Storage - Admin", robots: { index: false, follow: false } };

// Admin page for files in storage that no resource uses. Same guard as /admin: nothing renders before
// the admin check. Scanning is a server read triggered by ?scan=1, so there is no GET API route.
export default function AdminStoragePage({ searchParams }: PageProps<"/admin/storage">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-11 w-full max-w-sm md:h-9" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>}>
        {searchParams.then((raw) => (
          <StorageContent scan={raw.scan === "1"} />
        ))}
      </Suspense>
    </main>
  );
}

async function StorageContent({ scan }: { scan: boolean }) {
  const { admin } = await requireAdminPage("/admin/storage");

  return (
    <>
      <AdminBar current="storage" />
      <PageTitle>Storage</PageTitle>
      <section aria-labelledby="abandoned-heading" className="space-y-4 rounded-lg border bg-card p-4 md:p-5">
        <div className="space-y-1">
          <h2 id="abandoned-heading" className="text-lg font-semibold text-heading">Abandoned uploads</h2>
          <p>Files in storage that no resource uses, older than 24 hours.</p>
        </div>
        <Button asChild variant={scan ? "outline" : "default"} className="h-11 px-4 md:h-9 md:px-3">
          <Link href="/admin/storage?scan=1" prefetch={false}>Scan storage</Link>
        </Button>
        {scan && <ScanResult viewer={admin} />}
      </section>
    </>
  );
}

async function ScanResult({ viewer }: { viewer: Parameters<typeof findAbandonedUploads>[0] }) {
  // Dynamic data: the scan must run per request, never while prerendering.
  await connection();
  let found: AbandonedUploads;
  try {
    found = await findAbandonedUploads(viewer);
  } catch {
    // The admin check has passed, so this is a storage or database failure.
    return (
      <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
        Could not scan storage. Check the storage settings and try again.
      </p>
    );
  }
  const now = new Date();
  const files = found.files.map((file) => ({
    key: file.key,
    label: shortenKey(file.key),
    size: formatBytes(file.size),
    age: formatAge(file.lastModified, now),
  }));
  const oldestDays = found.files.length > 0 ? Math.floor((now.getTime() - found.files[0].lastModified.getTime()) / 86_400_000) : 0;
  return (
    <AbandonedList
      files={files}
      summary={`${found.files.length} abandoned ${found.files.length === 1 ? "file" : "files"} · ${formatBytes(found.totalBytes)} · oldest ${oldestDays} ${oldestDays === 1 ? "day" : "days"}`}
      totalSize={formatBytes(found.totalBytes)}
    />
  );
}
