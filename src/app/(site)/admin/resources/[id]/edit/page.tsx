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
import { getResourceForEdit } from "@/services/resources/write";
import { requireAdminPage } from "../../../guard";
import { formatSavedDate } from "../../form-helpers";
import { ResourceForm } from "../../resource-form";

export const metadata: Metadata = { title: "Edit resource", robots: { index: false, follow: false } };

export default function EditResourcePage({ params }: PageProps<"/admin/resources/[id]/edit">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-11 w-full max-w-sm md:h-9" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>}>
        {params.then(({ id }) => (
          <EditResourceContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EditResourceContent({ id }: { id: string }) {
  const { admin } = await requireAdminPage(`/admin/resources/${encodeURIComponent(id)}/edit`);
  const [courses, chapters, solutionTargets, resource] = await Promise.all([
    readForPage(() => listCourses(admin)),
    readForPage(() => listChapterOptions(admin)),
    readForPage(() => listSolutionTargets(admin)),
    readForPage(() => getResourceForEdit(admin, id)),
  ]);
  return (
    <>
      <AdminBar current="resources" />
      <FormBreadcrumb current="Edit resource" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="[&>div]:mb-0">
          <PageTitle>Edit resource</PageTitle>
        </div>
        <p className="flex items-center gap-2 text-[0.8125rem] text-muted-foreground">
          <span
            className={`rounded-full border px-2.5 py-0.5 font-medium ${
              resource.isPublished ? "border-primary/35 bg-accent text-accent-foreground" : "border-dashed text-heading"
            }`}
          >
            {resource.isPublished ? "Published" : "Draft"}
          </span>
          Last saved {formatSavedDate(resource.updatedAt)}
        </p>
      </div>
      <ResourceForm courses={courses} chapters={chapters} solutionTargets={solutionTargets} resource={resource} />
    </>
  );
}
