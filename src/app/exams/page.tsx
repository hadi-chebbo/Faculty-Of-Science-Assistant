import type { Metadata } from "next";
import { Suspense } from "react";
import { Crumbs } from "@/components/site/crumbs";
import { PageTitle } from "@/components/site/page-title";
import { ExamsFiltersSkeleton, ExamsListSkeleton } from "@/components/site/skeletons";
import { readForPage } from "@/lib/page-errors";
import { listExamFilterOptions } from "@/services/resources/resources";
import { ExamFilters } from "./filters";
import { parseExamParams, reconcileCourse } from "./params";
import { ExamResults } from "./results";

export const metadata: Metadata = { title: "Previous exams" };

// React streams the parts behind <Suspense> as hidden blocks that a script swaps in. Without
// JavaScript that never happens and the filters (a plain GET form) and the list would stay
// hidden behind the skeleton. For those visitors this shows the blocks and hides the skeleton.
// The blocks sit at the end of <body>, so the order is odd, but the page is usable.
// It is written inside the `base` layer because Tailwind's own `[hidden] { display: none !important }`
// lives there, and an important rule in a layer beats the same in unlayered CSS.
const NO_SCRIPT_CSS = `
  @layer base {
    div[hidden][id^="S:"] { display: block !important; width: 100%; max-width: 64rem; margin: 0 auto; padding: 0 1rem 4rem; }
    main [role="status"], div[id^="S:"] [role="status"] { display: none; }
  }
`;

// The breadcrumb and title do not depend on the URL, so they are part of the static shell.
// Everything that reads the search params or the database streams in behind a skeleton.
export default function ExamsPage({ searchParams }: PageProps<"/exams">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6 md:py-8">
      <Crumbs items={[{ label: "Home", href: "/" }, { label: "Exams" }]} />
      <PageTitle>Previous exams</PageTitle>
      <noscript>
        <style>{NO_SCRIPT_CSS}</style>
      </noscript>
      <Suspense
        fallback={
          <div role="status" aria-label="Loading exams">
            <ExamsFiltersSkeleton />
            <div className="mt-6">
              <ExamsListSkeleton />
            </div>
          </div>
        }
      >
        {searchParams.then((raw) => (
          <ExamsContent raw={raw} />
        ))}
      </Suspense>
    </main>
  );
}

// The filter options are needed twice: for the dropdowns and to tell whether the chosen course
// belongs to the chosen semester. The list streams after them, behind its own skeleton.
async function ExamsContent({ raw }: { raw: Record<string, string | string[] | undefined> }) {
  const options = await readForPage(() => listExamFilterOptions(null));
  const params = reconcileCourse(parseExamParams(raw), options.courses);

  return (
    <>
      <ExamFilters options={options} params={params} />
      <div className="mt-6">
        <Suspense
          fallback={
            <div role="status" aria-label="Loading exams">
              <ExamsListSkeleton />
            </div>
          }
        >
          <ExamResults params={params} />
        </Suspense>
      </div>
    </>
  );
}
