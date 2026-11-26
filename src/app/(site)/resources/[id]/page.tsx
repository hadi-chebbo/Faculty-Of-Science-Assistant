import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import { Suspense, cache } from "react";
import { BackLink } from "@/components/site/back-link";
import { Crumbs, type Crumb } from "@/components/site/crumbs";
import { StateBlock } from "@/components/site/state-block";
import { Skeleton } from "@/components/ui/skeleton";
import { TYPE_STYLES } from "@/lib/design-language";
import { EXAM_SESSION_LABELS, LANGUAGE_LABELS, LANGUAGE_NAMES, RESOURCE_TYPE_SINGULAR_LABELS, formatAcademicYear } from "@/lib/labels";
import { yearCrumb } from "@/lib/years";
import { readForPage } from "@/lib/page-errors";
import { readerBackTarget } from "@/services/resources/back-target";
import { isMarkable } from "@/services/progress/markable";
import { getResourceForReader } from "@/services/resources/reader";
import { PdfViewer } from "./pdf-viewer-loader";
import { ReaderDetails } from "./reader-details";
import { RememberLastRead } from "./remember-last-read";
import { ViewerSkeleton } from "./viewer-skeleton";

const CHIP = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium";
const MUTED_CHIP = `${CHIP} bg-muted text-foreground`;

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
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-8 w-64 max-w-full" />
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

  const TypeIcon = TYPE_STYLES[resource.type].icon;
  const metaChips = [
    ...(resource.academicYearStart !== null ? [{ key: "year", text: formatAcademicYear(resource.academicYearStart) }] : []),
    ...(resource.examSession ? [{ key: "session", text: EXAM_SESSION_LABELS[resource.examSession] }] : []),
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

      {/* Title line: the type's icon box, the title, then the type and language chips (the type is also
          named in words, never colour alone). */}
      <div data-reader-title className="mb-4 flex items-center gap-3">
        <span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TYPE_STYLES[resource.type].chip}`}>
          <TypeIcon className="size-[18px]" />
        </span>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-xl leading-tight font-semibold tracking-tight md:text-2xl">{resource.title}</h1>
          <span className={`${CHIP} ${TYPE_STYLES[resource.type].chip}`}>{RESOURCE_TYPE_SINGULAR_LABELS[resource.type]}</span>
          <span className={MUTED_CHIP}>
            {LANGUAGE_LABELS[resource.language]}
            <span className="sr-only"> ({LANGUAGE_NAMES[resource.language]})</span>
          </span>
          {metaChips.map((chip) => (
            <span key={chip.key} className={MUTED_CHIP}>
              {chip.text}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_14rem] lg:grid-cols-[minmax(0,1fr)_280px] md:items-start md:gap-4">
        {resource.hasFile ? (
          <>
            <RememberLastRead id={resource.id} title={resource.title} courseCode={resource.courseCode} type={resource.type} />
            <PdfViewer resourceId={resource.id} markable={isMarkable(resource.type)} />
          </>
        ) : (
          <StateBlock icon={FileQuestion}>There is no file to show for this resource.</StateBlock>
        )}
        <ReaderDetails resource={resource} />
      </div>
    </>
  );
}
