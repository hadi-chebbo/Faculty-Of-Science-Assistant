import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listCourseOptions } from "@/services/courses/courses";
import { requireAdminPage } from "../../guard";
import { ResourceForm } from "../resource-form";

export const metadata: Metadata = { title: "New resource", robots: { index: false, follow: false } };

export default function NewResourcePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <PageTitle>New resource</PageTitle>
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-xl" />}>
        <NewResourceContent />
      </Suspense>
    </main>
  );
}

async function NewResourceContent() {
  const { admin } = await requireAdminPage("/admin/resources/new");
  const courses = await readForPage(() => listCourseOptions(admin));
  return <ResourceForm courses={courses} />;
}
