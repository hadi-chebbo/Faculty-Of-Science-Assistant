import { Layers } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminBar } from "@/components/admin/admin-bar";
import { PageTitle } from "@/components/site/page-title";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { readForPage } from "@/lib/page-errors";
import { listChaptersWithCounts } from "@/services/chapters/chapters";
import { listCourses } from "@/services/courses/courses";
import type { Viewer } from "@/services/viewer";
import { requireAdminPage } from "../guard";
import { parseAdminParams } from "../params";
import { ChapterList } from "./chapter-list";

export const metadata: Metadata = { title: "Chapters - Admin", robots: { index: false, follow: false } };

// Admin page for one course's chapters. Same guard as /admin: nothing renders before the admin check.
export default function AdminChaptersPage({ searchParams }: PageProps<"/admin/chapters">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <PageTitle>Chapters</PageTitle>
      <Suspense fallback={<Skeleton className="h-16 w-full max-w-sm" />}>
        {searchParams.then((raw) => (
          <ChaptersContent raw={raw} />
        ))}
      </Suspense>
    </main>
  );
}

async function ChaptersContent({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const { admin } = await requireAdminPage("/admin/chapters");

  return (
    <>
      <AdminBar />
      <ChaptersForCourse viewer={admin} raw={raw} />
    </>
  );
}

async function ChaptersForCourse({ viewer, raw }: { viewer: Viewer; raw: Record<string, string | string[] | undefined> }) {
  const courses = await readForPage(() => listCourses(viewer));
  // A code that matches no course is ignored.
  const wanted = parseAdminParams(raw).course?.toLowerCase();
  const known = courses.find((c) => c.code.toLowerCase() === wanted);
  const chapters = known ? await readForPage(() => listChaptersWithCounts(viewer, known.id)) : [];

  return (
    <section className="space-y-5" aria-label="Chapters">
      <form action="/admin/chapters" method="get" className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="sm:w-80">
          <label htmlFor="chapters-course" className="mb-1.5 block text-sm font-medium text-heading">Course</label>
          <NativeSelect id="chapters-course" name="course" defaultValue={known?.code ?? ""} className="w-full [&_select]:h-11 md:[&_select]:h-9">
            <NativeSelectOption value="">Choose a course</NativeSelectOption>
            {courses.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.code} - {c.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" className="h-11 px-4 md:h-9 md:px-3">Apply</Button>
      </form>

      {known ? (
        <ChapterList courseId={known.id} courseCode={known.code} chapters={chapters} />
      ) : (
        <StateBlock icon={Layers}>Choose a course to manage its chapters.</StateBlock>
      )}
    </section>
  );
}
