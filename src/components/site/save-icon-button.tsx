"use client";

import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedResource } from "@/lib/saved-client";
import { cn } from "@/lib/utils";

// The bookmark at the right of a resource row: outline when not saved, filled when saved. While the
// answer is still unknown it looks not saved, so nothing moves when it arrives. Signed out, it
// leads to sign-in and back (the shared store handles that).
export function SaveIconButton({ resourceId, title }: { resourceId: string; title: string }) {
  const { status, pending, toggle } = useSavedResource(resourceId);
  const saved = status === "saved";
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
      disabled={pending}
      onClick={() => void toggle()}
      className="size-11 md:size-9"
    >
      <Bookmark aria-hidden className={cn("size-5", saved ? "fill-current text-link" : "text-muted-foreground")} />
    </Button>
  );
}
