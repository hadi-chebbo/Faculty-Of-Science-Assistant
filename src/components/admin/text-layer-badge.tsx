import { Badge } from "@/components/ui/badge";
import { textLayerStatus } from "@/lib/pdf-text-check";

// "Scanned" or "Partly scanned" for the admin, with the page counts as its title. Nothing for a file
// that has text or was not checked. Muted on purpose: it is information, not an error.
export function TextLayerBadge({ pageCount, textPageCount }: { pageCount: number | null; textPageCount: number | null }) {
  const status = textLayerStatus(pageCount, textPageCount);
  if (status !== "scanned" && status !== "partial") return null;
  const detail = `${textPageCount} of ${pageCount} pages have text`;
  return (
    <Badge variant="outline" className="bg-muted text-foreground" title={detail} data-testid="text-layer-badge">
      {status === "scanned" ? "Scanned" : "Partly scanned"}
      <span className="sr-only"> ({detail})</span>
    </Badge>
  );
}
