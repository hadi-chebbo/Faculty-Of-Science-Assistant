import { FileText } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// A card-shaped placeholder while the viewer code or the file is loading, so the page does not
// jump when the document appears. One calm loader sits in the middle of the reading area.
// `percent` is how much of the file has arrived, when the server said how big it is.
export function ViewerSkeleton({ percent }: { percent?: number | null }) {
  const known = typeof percent === "number";
  return (
    <div
      role="status"
      aria-label="Loading the file"
      className="flex flex-col overflow-hidden rounded-3xl border bg-card h-[max(24rem,calc(100dvh-13rem))] md:h-[max(30rem,calc(100dvh-13rem))]"
    >
      <div className="h-[52px] shrink-0 border-b md:h-12" />
      <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center gap-4 bg-muted p-6 md:min-h-0">
        <div className="relative flex size-16 items-center justify-center">
          <span aria-hidden className="absolute inset-0 rounded-full border-2 border-primary/15" />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary motion-safe:animate-spin"
          />
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileText aria-hidden className="size-6" />
          </span>
        </div>
        <p className="text-sm font-medium text-foreground">Loading the file…</p>
        {known && (
          <div className="flex w-48 max-w-full flex-col items-center gap-2">
            <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
              {percent}%
            </span>
            <Progress value={percent} className="h-1 bg-border" aria-label="Download progress" />
          </div>
        )}
      </div>
    </div>
  );
}
