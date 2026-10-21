import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { FormBreadcrumb } from "@/components/admin/form-breadcrumb";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listChapterOptions } from "@/services/chapters/options";
import { listCourses } from "@/services/courses/courses";
import { requireAdminPage } from "../../guard";
import { parseAdminParams } from "../../params";
import { BulkUpload } from "./bulk-upload";

export const metadata: Metadata = { title: "Bulk upload", robots: { index: false, follow: false } };

export default function BulkUploadPage({ searchParams }: PageProps<"/admin/resources/bulk">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">
      <Suspense fallback={<div className="space-y-4" aria-hidden>
          <Skeleton className="h-11 w-full max-w-sm md:h-9" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>}>
        {searchParams.then((raw) => (
          <BulkUploadContent raw={raw} />
        ))}
      </Suspense>
    </main>
  );
}

async function BulkUploadContent({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const { admin } = await requireAdminPage("/admin/resources/bulk");
  const [courses, chapters] = await Promise.all([
    readForPage(() => listCourses(admin)),
    readForPage(() => listChapterOptions(admin)),
  ]);
  // ?course=CODE preselects a course; an unknown code is ignored.
  const wanted = parseAdminParams(raw).course?.toLowerCase();
  const initial = courses.find((c) => c.code.toLowerCase() === wanted);
  return (
    <>
      <AdminBar current="resources" />
      <FormBreadcrumb current="Bulk upload" />
      <PageTitle>Bulk upload</PageTitle>
      <BulkUpload courses={courses} chapters={chapters} initialCourseId={initial?.id ?? ""} />
    </>
  );
}
