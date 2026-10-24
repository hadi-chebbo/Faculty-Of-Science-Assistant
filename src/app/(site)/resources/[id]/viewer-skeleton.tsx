import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// A card-shaped placeholder while the viewer code or the file is loading, so the page does not
// jump when the document appears. `percent` is how much of the file has arrived, when the server
// said how big it is.
export function ViewerSkeleton({ percent }: { percent?: number | null }) {
  return (
    <div
      role="status"
      aria-label="Loading the file"
      className="flex flex-col overflow-hidden rounded-xl border bg-card md:h-[max(30rem,calc(100dvh-13rem))]"
    >
      <div className="h-[52px] shrink-0 border-b md:h-12" />
      <div className="flex min-h-0 flex-1 flex-col items-center gap-3 bg-muted p-4">
        <Skeleton className="aspect-[1/1.414] w-full max-w-3xl rounded-none md:h-full md:w-auto" />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{typeof percent === "number" ? `Loading the file… ${percent}%` : "Loading the file…"}</span>
          {typeof percent === "number" && <Progress value={percent} className="max-w-48" aria-label="Download progress" />}
        </div>
      </div>
    </div>
  );
}
