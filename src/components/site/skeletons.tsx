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
