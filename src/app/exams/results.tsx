import { FileText, SearchX } from "lucide-react";
import Link from "next/link";
import { ResourceRow } from "@/components/site/resource-row";
import { StateBlock } from "@/components/site/state-block";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { readForPage } from "@/lib/page-errors";
import { listResources } from "@/services/resources/resources";
import { EXAMS_PAGE_SIZE, hasActiveFilters, pagerLinks, type ExamParams } from "./params";

// Viewer is always null for now: browsing needs no account.
export async function ExamResults({ params }: { params: ExamParams }) {
  const result = await readForPage(() =>
    listResources(null, {
      type: "exam",
      semester: params.semester,
      courseCode: params.course,
      academicYearStart: params.year,
      examSession: params.session,
      page: params.page,
      pageSize: EXAMS_PAGE_SIZE,
    }),
  );

  if (result.items.length === 0) {
    const none = result.total === 0 && !hasActiveFilters(params);
    return (
      <StateBlock
        icon={none ? FileText : SearchX}
        actions={
          !none && (
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href="/exams">Clear filters</Link>
            </Button>
          )
        }
      >
        {none ? "No exams yet." : "No exams match these filters."}
      </StateBlock>
    );
  }

  const { pages, previous, next } = pagerLinks(params, result.total, result.pageSize);
  return (
    <>
      <p className="mb-3 text-sm font-medium" aria-live="polite">
        {result.total} {result.total === 1 ? "exam" : "exams"}
        {pages > 1 && ` - page ${result.page} of ${pages}`}
      </p>
      <ul className="space-y-2">
        {result.items.map((exam) => (
          <ResourceRow key={exam.id} resource={exam} showCourse />
        ))}
      </ul>
      {pages > 1 && (
        <Pagination className="mt-8" aria-label="Exam pages">
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
  );
}
