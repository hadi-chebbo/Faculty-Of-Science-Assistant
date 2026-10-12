import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listCourseOptions } from "@/services/courses/courses";
import { getResourceForEdit } from "@/services/resources/write";
import { requireAdminPage } from "../../../guard";
import { ResourceForm } from "../../resource-form";

export const metadata: Metadata = { title: "Edit resource", robots: { index: false, follow: false } };

export default function EditResourcePage({ params }: PageProps<"/admin/resources/[id]/edit">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <PageTitle>Edit resource</PageTitle>
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-xl" />}>
        {params.then(({ id }) => (
          <EditResourceContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

async function EditResourceContent({ id }: { id: string }) {
  const { admin } = await requireAdminPage(`/admin/resources/${encodeURIComponent(id)}/edit`);
  const [courses, resource] = await Promise.all([
    readForPage(() => listCourseOptions(admin)),
    readForPage(() => getResourceForEdit(admin, id)),
  ]);
  return <ResourceForm courses={courses} resource={resource} />;
}
