import { Skeleton } from "@/components/ui/skeleton";

export function TitleSkeleton() {
  return (
    <div className="mb-6" aria-hidden>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-1 w-12" />
    </div>
  );
}

export function CourseListSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading courses">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[6.5rem] w-full rounded-xl" />
      ))}
    </div>
  );
}

export function CourseSkeleton() {
  return (
    <div role="status" aria-label="Loading course">
      <TitleSkeleton />
      <Skeleton className="h-9 w-72 max-w-full" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full" />
        ))}
      </div>
    </div>
  );
}

export function SavedSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-label="Loading saved files">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i}>
          <Skeleton className="mb-3 h-6 w-64 max-w-full" />
          <div className="space-y-2">
            <Skeleton className="h-[4.5rem] w-full" />
            <Skeleton className="h-[4.5rem] w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TodoSkeleton() {
  return (
    <div role="status" aria-label="Loading your board">
      <Skeleton className="h-12 w-full md:hidden" />
      <div className="hidden grid-cols-3 gap-4 md:grid">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function SemesterSkeleton() {
  return (
    <div role="status" aria-label="Loading semester">
      <TitleSkeleton />
      <CourseListSkeleton />
    </div>
  );
}

export function ExamsFiltersSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[4.25rem] w-full" />
        ))}
      </div>
      <Skeleton className="mt-4 h-11 w-20 md:h-9" />
    </div>
  );
}

export function ExamsListSkeleton() {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[4.5rem] w-full" />
      ))}
    </div>
  );
}

// Home page: the numbers strip and the semester cards, which are read together.
export function StatsAndSemestersSkeleton() {
  return (
    <div className="contents" role="status" aria-label="Loading semesters">
      <Skeleton className="-mt-4 h-[7.5rem] w-full rounded-lg sm:h-[4.75rem] md:-mt-8" />
      {/* Same id as the real section: "Browse courses" (#semesters) can be clicked while the
          semesters are still loading, and must land here rather than nowhere. */}
      <div id="semesters" className="scroll-mt-20">
        <div className="mb-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2.5 h-1 w-12" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Search page: the box and a few result rows.
export function SearchSkeleton() {
  return (
    <div role="status" aria-label="Loading search">
      <TitleSkeleton />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem] w-full" />
        ))}
      </div>
    </div>
  );
}
