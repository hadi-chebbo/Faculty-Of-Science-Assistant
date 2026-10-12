import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { EXAM_SESSION_LABELS, formatAcademicYear, RESOURCE_TYPE_LABELS } from "@/lib/labels";
import { readForPage } from "@/lib/page-errors";
import { listCourses } from "@/services/courses/courses";
import { listResources } from "@/services/resources/resources";
import type { Viewer } from "@/services/viewer";
import { adminHref, parseAdminParams, type AdminParams } from "./params";

const PAGE_SIZE = 20;

// Read-only list of every resource, drafts included. Rendered only after the admin check.
export async function ResourceList({ viewer, raw }: { viewer: Viewer; raw: Record<string, string | string[] | undefined> }) {
  const courses = await readForPage(() => listCourses(viewer));
  const parsed = parseAdminParams(raw);
  // A code that matches no course is ignored; a known one is written with its real letter case.
  const known = courses.find((c) => c.code.toLowerCase() === parsed.course?.toLowerCase());
  const params: AdminParams = { course: known?.code, page: parsed.page };

  const result = await readForPage(() =>
    listResources(viewer, { courseCode: params.course, page: params.page, pageSize: PAGE_SIZE }),
  );
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const previous = params.page > 1 ? adminHref({ ...params, page: params.page - 1 }) : null;
  const next = params.page < pages ? adminHref({ ...params, page: params.page + 1 }) : null;

  return (
    <section className="space-y-4" aria-label="Resources">
      <form action="/admin" method="get" className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-72">
          <label htmlFor="admin-course" className="mb-1.5 block text-sm font-medium text-heading">Course</label>
          <NativeSelect id="admin-course" name="course" defaultValue={params.course ?? ""} className="w-full [&_select]:h-11 md:[&_select]:h-9">
            <NativeSelectOption value="">All courses</NativeSelectOption>
            {courses.map((c) => (
              <NativeSelectOption key={c.code} value={c.code}>
                {c.code} - {c.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" className="h-11 px-4 md:h-9 md:px-3">Apply</Button>
      </form>
      <Link href="/admin/resources/new" className={buttonVariants({ className: "h-11 px-4 md:h-9 md:px-3" })}>
        New resource
      </Link>

      {result.items.length === 0 ? (
        <p className="rounded-lg border bg-card p-4">No resources match.</p>
      ) : (
        <>
          <p className="text-sm" aria-live="polite">
            {result.total} {result.total === 1 ? "resource" : "resources"}
            {pages > 1 && ` - page ${result.page} of ${pages}`}
          </p>
          <ul className="space-y-2">
            {result.items.map((r) => (
              <li key={r.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium text-heading">{r.title}</p>
                  <Badge variant={r.isPublished ? "secondary" : "outline"}>{r.isPublished ? "Published" : "Draft"}</Badge>
                </div>
                <p className="mt-1 text-sm">
                  {r.courseCode} - {RESOURCE_TYPE_LABELS[r.type]}
                  {r.academicYearStart !== null && ` - ${formatAcademicYear(r.academicYearStart)}`}
                  {r.examSession !== null && ` - ${EXAM_SESSION_LABELS[r.examSession]}`}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-4">
                  <Link
                    href={`/admin/resources/${r.id}/edit`}
                    aria-label={`Edit ${r.title}`}
                    className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 md:min-h-0"
                  >
                    Edit
                  </Link>
                  {r.hasSource ? (
                    // A plain <a>, like the public row: the target is a route that redirects, not a page.
                    <a
                      href={`/api/v1/resources/${r.id}/open`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${r.title}`}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline underline-offset-4 md:min-h-0"
                    >
                      Open
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">No file or link yet</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <Pagination aria-label="Resource pages">
              <PaginationContent>
                {previous && (
                  <PaginationItem>
                    <PaginationPrevious href={previous} className="min-h-11" />
                  </PaginationItem>
                )}
                <PaginationItem className="px-2 text-sm">
                  Page {result.page} of {pages}
                </PaginationItem>
                {next && (
                  <PaginationItem>
                    <PaginationNext href={next} className="min-h-11" />
                  </PaginationItem>
                )}
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </section>
  );
}
