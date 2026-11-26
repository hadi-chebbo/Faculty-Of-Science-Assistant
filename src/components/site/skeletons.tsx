import { YEARS } from "@/lib/years";
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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading courses">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-3xl" />
      ))}
    </div>
  );
}

export function CourseSkeleton() {
  return (
    <div role="status" aria-label="Loading course">
      <div className="mb-6" aria-hidden>
        <Skeleton className="hidden h-5 w-52 md:block" />
        <div className="flex flex-col items-start gap-2 md:mt-2.5 md:flex-row md:items-center md:gap-3">
          <Skeleton className="my-1.5 h-8 w-28 rounded-full md:my-0" />
          <Skeleton className="h-8 w-64 max-w-full" />
        </div>
        <Skeleton className="mt-3 h-1 w-12" />
      </div>
      <Skeleton className="h-11 w-80 max-w-full rounded-2xl" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-3xl" />
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

export function ProgressSkeleton() {
  return (
    <div role="status" aria-label="Loading your progress">
      <Skeleton className="mb-3 h-6 w-32" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
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

export function YearSkeleton() {
  return (
    <div role="status" aria-label="Loading year">
      <div className="mb-6" aria-hidden>
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full md:size-14" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="mt-3 h-1 w-12" />
      </div>
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

// Home page: the year cards and the numbers row under them.
export function YearCardsSkeleton() {
  return (
    <div className="contents" role="status" aria-label="Loading years">
      {/* Same id as the real section: "Choose your year" (#years) can be clicked while the
          years are still loading, and must land here rather than nowhere. */}
      <div id="years" className="home-years scroll-mt-20">
        <div className="mb-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2.5 h-1 w-12" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {YEARS.map((year) => (
            <Skeleton key={year} className="h-44 w-full rounded-3xl" />
          ))}
        </div>
      </div>
      <div className="home-stats grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-3xl md:h-36" />
        ))}
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
