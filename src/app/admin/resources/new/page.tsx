import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { FormBreadcrumb } from "@/components/admin/form-breadcrumb";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listChapterOptions } from "@/services/chapters/options";
import { listCourses } from "@/services/courses/courses";
import { listSolutionTargets } from "@/services/resources/solution-targets";
import { requireAdminPage } from "../../guard";
import { ResourceForm } from "../resource-form";

export const metadata: Metadata = { title: "New resource", robots: { index: false, follow: false } };

export default function NewResourcePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-11 w-full max-w-sm md:h-9" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full max-w-2xl" />
        </div>}>
        <NewResourceContent />
      </Suspense>
    </main>
  );
}

async function NewResourceContent() {
  const { admin } = await requireAdminPage("/admin/resources/new");
  const [courses, chapters, solutionTargets] = await Promise.all([
    readForPage(() => listCourses(admin)),
    readForPage(() => listChapterOptions(admin)),
    readForPage(() => listSolutionTargets(admin)),
  ]);
  return (
    <>
      <AdminBar current="resources" />
      <FormBreadcrumb current="New resource" />
      <PageTitle>New resource</PageTitle>
      <ResourceForm courses={courses} chapters={chapters} solutionTargets={solutionTargets} />
    </>
  );
}
