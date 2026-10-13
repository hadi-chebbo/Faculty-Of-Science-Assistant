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
import { ResourceForm } from "../../resource-form";

export const metadata: Metadata = { title: "Edit resource", robots: { index: false, follow: false } };

export default function EditResourcePage({ params }: PageProps<"/admin/resources/[id]/edit">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <FormBreadcrumb current="Edit resource" />
      <PageTitle>Edit resource</PageTitle>
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-2xl" />}>
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
      <AdminBar />
      <ResourceForm courses={courses} chapters={chapters} solutionTargets={solutionTargets} resource={resource} />
    </>
  );
}
