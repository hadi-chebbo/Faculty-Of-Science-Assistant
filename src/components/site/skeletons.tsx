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
        <Skeleton key={i} className="h-20 w-full" />
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
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
