import { ExternalLink, Pencil, Plus } from "lucide-react";
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

// Phone: a card per row. md+: the same four parts as grid columns, matching the header row.
const COLUMNS = "md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6rem_12rem]";
const BADGE_PLACE = "justify-self-end md:col-start-3 md:row-start-1 md:justify-self-start";

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
  const actionClass = buttonVariants({ variant: "outline", size: "sm", className: "h-11 px-3 md:h-8" });

  return (
    <section className="space-y-5" aria-label="Resources">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-heading" aria-live="polite">
          {result.total} {result.total === 1 ? "resource" : "resources"}
          {pages > 1 && (
            <span className="text-sm font-normal text-muted-foreground"> - page {result.page} of {pages}</span>
          )}
        </h2>
        <Link href="/admin/resources/new" className={buttonVariants({ className: "h-11 px-4 md:h-9 md:px-3" })}>
          <Plus aria-hidden />
          New resource
        </Link>
      </div>

      <form action="/admin" method="get" className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
        <div className="sm:w-80">
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

      {result.items.length === 0 ? (
        <p className="rounded-lg border bg-card p-4">No resources match.</p>
      ) : (
        <>
          <div className="space-y-2">
            {/* Visual column labels only; each row's own text already says what it is. */}
            <div aria-hidden className={`hidden gap-x-4 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid ${COLUMNS}`}>
              <span>Title</span>
              <span>Course - type - year - session</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
            <ul className="space-y-2">
              {result.items.map((r) => (
                <li
                  key={r.id}
                  className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-4 md:gap-y-0 md:py-3 ${COLUMNS}`}
                >
                  <p className="font-medium text-heading md:col-start-1 md:row-start-1">{r.title}</p>
                  <Badge
                    variant="outline"
                    className={
                      r.isPublished
                        ? `${BADGE_PLACE} border-emerald-700/30 bg-emerald-100 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950 dark:text-emerald-200`
                        : `${BADGE_PLACE} border-dashed text-foreground`
                    }
                  >
                    {r.isPublished ? "Published" : "Draft"}
                  </Badge>
                  <p className="col-span-2 text-sm md:col-span-1 md:col-start-2 md:row-start-1">
                    {r.courseCode} - {RESOURCE_TYPE_LABELS[r.type]}
                    {r.academicYearStart !== null && ` - ${formatAcademicYear(r.academicYearStart)}`}
                    {r.examSession !== null && ` - ${EXAM_SESSION_LABELS[r.examSession]}`}
                  </p>
                  <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:col-start-4 md:row-start-1 md:justify-end">
                    {!r.hasSource && <span className="mr-auto text-sm text-muted-foreground md:mr-0">No file or link yet</span>}
                    <Link href={`/admin/resources/${r.id}/edit`} aria-label={`Edit ${r.title}`} className={actionClass}>
                      <Pencil aria-hidden />
                      Edit
                    </Link>
                    {r.hasSource && (
                      // A plain <a>, like the public row: the target is a route that redirects, not a page.
                      <a
                        href={`/api/v1/resources/${r.id}/open`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${r.title}`}
                        className={actionClass}
                      >
                        <ExternalLink aria-hidden />
                        Open
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
          {pages > 1 && (
            <Pagination aria-label="Resource pages">
              <PaginationContent>
                {previous && (
                  <PaginationItem>
                    <PaginationPrevious href={previous} className="min-h-11" />
                  </PaginationItem>
                )}
                <PaginationItem className="px-3 text-sm text-muted-foreground">
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
