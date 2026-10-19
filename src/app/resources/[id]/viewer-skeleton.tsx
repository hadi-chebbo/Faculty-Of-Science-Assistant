import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

// A page-shaped placeholder while the viewer code or the file is loading. `percent` is how much
// of the file has arrived, when the server said how big it is.
export function ViewerSkeleton({ percent }: { percent?: number | null }) {
  return (
    <div role="status" aria-label="Loading the file">
      <Skeleton className="aspect-[1/1.414] w-full rounded-lg" />
      <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
        <span>{typeof percent === "number" ? `Loading the file… ${percent}%` : "Loading the file…"}</span>
        {typeof percent === "number" && <Progress value={percent} className="max-w-48" aria-label="Download progress" />}
      </div>
    </div>
  );
}
