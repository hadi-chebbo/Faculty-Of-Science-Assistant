import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listAdminLecturers } from "@/services/lecturers/admin";
import type { Viewer } from "@/services/viewer";
import { requireAdminPage } from "../guard";
import { DeleteLecturerButton } from "./delete-lecturer-button";
import { EditLecturerButton } from "./edit-lecturer-button";
import { NewLecturerCard } from "./new-lecturer-card";

export const metadata: Metadata = { title: "Lecturers - Admin", robots: { index: false, follow: false } };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

// Admin only, checked on the server before anything renders. Uncached (see next.config.ts).
export default function AdminLecturersPage() {
  return (
    <main className="page-container py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
        </div>}>
        <LecturersContent />
      </Suspense>
    </main>
  );
}

async function LecturersContent() {
  const { admin } = await requireAdminPage("/admin/lecturers");
  return (
    <>
      <AdminBar current="lecturers" />
      <PageTitle>Lecturers</PageTitle>
      <LecturerList viewer={admin} />
    </>
  );
}

async function LecturerList({ viewer }: { viewer: Viewer }) {
  const lecturers = await readForPage(() => listAdminLecturers(viewer));
  return (
    <section className="space-y-6" aria-label="Lecturers">
      <NewLecturerCard />
      <h2 className="text-lg font-semibold text-heading" aria-live="polite">{plural(lecturers.length, "lecturer")}</h2>
      {lecturers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No lecturers yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {lecturers.map((l) => (
            <li key={l.id} className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="font-medium text-heading">{l.name}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono">{l.slug}</span> · {plural(l.fileCount, "file")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EditLecturerButton lecturer={l} />
                <DeleteLecturerButton lecturer={l} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
