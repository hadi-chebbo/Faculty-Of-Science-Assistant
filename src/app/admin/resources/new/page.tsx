import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { FormBreadcrumb } from "@/components/admin/form-breadcrumb";
import { PageTitle } from "@/components/site/page-title";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listCourses } from "@/services/courses/courses";
import { requireAdminPage } from "../../guard";
import { ResourceForm } from "../resource-form";

export const metadata: Metadata = { title: "New resource", robots: { index: false, follow: false } };

export default function NewResourcePage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <FormBreadcrumb current="New resource" />
      <PageTitle>New resource</PageTitle>
      <Suspense fallback={<Skeleton className="h-64 w-full max-w-2xl" />}>
        <NewResourceContent />
      </Suspense>
    </main>
  );
}

async function NewResourceContent() {
  const { account, admin } = await requireAdminPage("/admin/resources/new");
  const courses = await readForPage(() => listCourses(admin));
  return (
    <>
      <AdminBar email={account.email} />
      <ResourceForm courses={courses} />
    </>
  );
}
