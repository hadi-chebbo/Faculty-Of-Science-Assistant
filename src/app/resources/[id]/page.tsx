import { ArrowLeft, FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, cache } from "react";
import { Crumbs, type Crumb } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { StateBlock } from "@/components/site/state-block";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAM_SESSION_LABELS, RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import { readForPage } from "@/lib/page-errors";
import { readerBackTarget } from "@/services/resources/back-target";
import { getResourceForReader } from "@/services/resources/reader";
import { PdfViewer } from "./pdf-viewer-loader";
import { ReaderActions } from "./reader-actions";
import { ReaderDetails } from "./reader-details";
import { ViewerSkeleton } from "./viewer-skeleton";

const FOCUS = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

// One read per request, shared by the page and its metadata. Public page: it reads as an anonymous
// viewer and never looks at the session, so only published resources are found.
const readResource = cache((id: string) => readForPage(() => getResourceForReader(id)));

export async function generateMetadata({ params }: PageProps<"/resources/[id]">): Promise<Metadata> {
  try {
    const resource = await readResource((await params).id);
    return { title: `${resource.title} (${resource.courseCode})` };
  } catch {
    // The page itself shows the 404; the title only needs to be sensible meanwhile.
    return { title: "Resource" };
  }
}

// Resource ids are runtime data: reading one happens inside Suspense, behind a skeleton.
export default function ReaderPage({ params }: PageProps<"/resources/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Suspense fallback={<ReaderSkeleton />}>
        {params.then(({ id }) => (
          <ReaderContent id={id} />
        ))}
      </Suspense>
    </main>
  );
}

function ReaderSkeleton() {
  return (
    <div role="status" aria-label="Loading resource">
      <Skeleton className="mb-4 h-6 w-24 md:hidden" />
      <div className="mb-6">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="mt-3 h-1 w-12" />
      </div>
      <ViewerSkeleton />
    </div>
  );
}

async function ReaderContent({ id }: { id: string }) {
  const resource = await readResource(id);
  const back = readerBackTarget(resource);
  const course = `/courses/${encodeURIComponent(resource.courseCode)}`;

  // The breadcrumb ends with the course area that lists this resource (the same place as Back).
  const area: Crumb | null =
    back === course
      ? null
      : {
          label:
            resource.type === "exam"
              ? "Previous exams"
              : resource.chapterPosition !== null
                ? `Chapter ${resource.chapterPosition}`
                : "Other material",
          href: back,
        };
  const crumbs: Crumb[] = [
    { label: "Home", href: "/" },
    { label: `Semester ${resource.courseSemester}`, href: `/semesters/${resource.courseSemester}` },
    { label: resource.courseCode, href: course },
    ...(area ? [area] : []),
    { label: resource.title },
  ];

  const facts = [
    RESOURCE_TYPE_SINGULAR_LABELS[resource.type],
    resource.language === "en" ? "English" : "French",
    ...(resource.academicYearStart !== null ? [formatAcademicYear(resource.academicYearStart)] : []),
    ...(resource.examSession ? [EXAM_SESSION_LABELS[resource.examSession]] : []),
  ];

  return (
    <>
      <Link
        href={back}
        aria-label={`Back to ${area ? `${resource.courseCode}, ${area.label.toLowerCase()}` : resource.courseCode}`}
        className={`-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-link md:hidden ${FOCUS}`}
      >
        <ArrowLeft aria-hidden className="size-4" />
        <span className="font-mono">{resource.courseCode}</span>
      </Link>
      <Crumbs items={crumbs} />

      <div className="md:flex md:items-start md:justify-between md:gap-6">
        <PageTitle description={<span className="text-sm">{facts.join(" · ")}</span>}>{resource.title}</PageTitle>
        {resource.hasFile && (
          <div className="-mt-2 mb-6 md:mt-0 md:shrink-0">
            <ReaderActions id={resource.id} />
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
        {resource.hasFile ? (
          <PdfViewer resourceId={resource.id} />
        ) : (
          <StateBlock icon={FileQuestion}>There is no file to show for this resource.</StateBlock>
        )}
        <ReaderDetails resource={resource} />
      </div>
    </>
  );
}
