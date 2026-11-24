import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { BackLink } from "@/components/site/back-link";
import { Crumbs, type Crumb } from "@/components/site/crumbs";
import { StateBlock } from "@/components/site/state-block";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAM_SESSION_LABELS, LANGUAGE_NAMES, RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import { yearCrumb } from "@/lib/years";
import { readForPage } from "@/lib/page-errors";
import { readerBackTarget } from "@/services/resources/back-target";
import { isMarkable } from "@/services/progress/markable";
import { getResourceForReader } from "@/services/resources/reader";
import { PdfViewer } from "./pdf-viewer-loader";
import { ReaderDetails } from "./reader-details";
import { ViewerSkeleton } from "./viewer-skeleton";


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
    <main id="main" tabIndex={-1} className="scroll-mt-20 outline-none page-container pt-4 pb-6 md:pt-4 md:pb-5">
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
      <div className="mb-4">
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
    yearCrumb(resource.courseSemester),
    { label: resource.courseCode, href: course },
    ...(area ? [area] : []),
    { label: resource.title },
  ];

  const facts = [
    RESOURCE_TYPE_SINGULAR_LABELS[resource.type],
    LANGUAGE_NAMES[resource.language],
    ...(resource.academicYearStart !== null ? [formatAcademicYear(resource.academicYearStart)] : []),
    ...(resource.examSession ? [EXAM_SESSION_LABELS[resource.examSession]] : []),
  ];

  return (
    <>
      <BackLink
        href={back}
        label={`Back to ${area ? `${resource.courseCode}, ${area.label.toLowerCase()}` : resource.courseCode}`}
      >
        <span className="font-mono">{resource.courseCode}</span>
      </BackLink>
      <Crumbs items={crumbs} />

      {/* Compact title: type and language beside the title from md up, below it on a phone. */}
      <div className="mb-4 grid gap-x-3 md:grid-cols-[auto_1fr] md:items-baseline">
        <h1 className="text-[1.375rem] font-semibold tracking-tight md:col-start-1 md:row-start-1 md:text-2xl">
          {resource.title}
        </h1>
        <div className="mt-3 h-1 w-12 rounded-full bg-highlight md:col-span-2 md:row-start-2 md:mt-2" aria-hidden />
        <p className="mt-3 text-sm md:col-start-2 md:row-start-1 md:mt-0">{facts.join(" · ")}</p>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_14rem] md:items-start md:gap-4">
        {resource.hasFile ? (
          <PdfViewer resourceId={resource.id} markable={isMarkable(resource.type)} />
        ) : (
          <StateBlock icon={FileQuestion}>There is no file to show for this resource.</StateBlock>
        )}
        <ReaderDetails resource={resource} />
      </div>
    </>
  );
}
