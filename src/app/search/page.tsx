import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTitle } from "@/components/site/page-title";
import { SearchSkeleton } from "@/components/site/skeletons";
import { parseSearchParams, type SearchParams } from "./params";
import { SearchResults } from "./results";
import { SearchForm } from "./search-form";

// "Search", or "“graphs” – Search" once there is something typed. The template adds the site name.
export async function generateMetadata({ searchParams }: PageProps<"/search">): Promise<Metadata> {
  const { q } = parseSearchParams(await searchParams);
  const shown = Array.from(q).length > 60 ? `${Array.from(q).slice(0, 60).join("")}…` : q;
  return { title: shown ? `“${shown}” – Search` : "Search" };
}

// Same as on the exams page: React streams what is behind <Suspense> as hidden blocks that a
// script swaps in. Without JavaScript that never happens, so for those visitors this shows the
// blocks (the form and the results) and hides the skeleton. It sits in the `base` layer because
// Tailwind's own `[hidden] { display: none !important }` lives there.
const NO_SCRIPT_CSS = `
  @layer base {
    div[hidden][id^="S:"] { display: block !important; width: 100%; max-width: 55rem; margin: 0 auto; padding: 0 1rem 4rem; }
    main [role="status"], div[id^="S:"] [role="status"] { display: none; }
  }
`;

// Everything depends on the address, so it all streams in behind a skeleton.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto w-full max-w-[55rem] px-4 py-6 md:py-8">
      <noscript>
        <style>{NO_SCRIPT_CSS}</style>
      </noscript>
      <Suspense fallback={<SearchSkeleton />}>
        {searchParams.then((raw) => (
          <SearchContent params={parseSearchParams(raw)} />
        ))}
      </Suspense>
    </main>
  );
}

function SearchContent({ params }: { params: SearchParams }) {
  const active = Array.from(params.q).length >= 2;
  return (
    <>
      {/* On a phone the results need the room, so the visible title is for the start page and for
          larger screens; the heading itself is always there. */}
      {active ? (
        <>
          <h1 className="sr-only md:hidden">Search</h1>
          <div className="hidden md:block">
            <PageTitle>Search</PageTitle>
          </div>
        </>
      ) : (
        <PageTitle>Search</PageTitle>
      )}
      <div className="space-y-4">
        <SearchForm q={params.q} type={params.type} />
        <Suspense
          fallback={
            <div role="status" aria-label="Loading results" className="space-y-2" aria-busy>
              <div className="h-11 animate-pulse rounded-full bg-muted" />
              <div className="h-[4.5rem] animate-pulse rounded-lg bg-muted" />
              <div className="h-[4.5rem] animate-pulse rounded-lg bg-muted" />
            </div>
          }
        >
          <SearchResults params={params} />
        </Suspense>
      </div>
    </>
  );
}
