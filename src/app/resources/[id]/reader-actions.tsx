import { Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Plain <a> elements, not next/link: both targets are API routes that redirect to the file, and
// Link would prefetch them when they scroll into view.
export function ReaderActions({ id }: { id: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild className="h-11 md:h-9">
        <a href={`/api/v1/resources/${id}/download`}>
          <Download aria-hidden />
          Download
        </a>
      </Button>
      <Button asChild variant="outline" className="h-11 md:h-9">
        <a href={`/api/v1/resources/${id}/open`} target="_blank" rel="noopener">
          <ExternalLink aria-hidden />
          Open outside
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </Button>
    </div>
  );
}
