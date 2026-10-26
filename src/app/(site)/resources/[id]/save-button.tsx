"use client";

import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSavedResource } from "@/lib/saved-client";

// "Save for later" in the details column; "Saved" once it is. Same state as the More actions menu.
// While the answer is still unknown it looks like "Save for later", so nothing moves when it arrives.
export function SaveButton({ resourceId }: { resourceId: string }) {
  const { status, pending, toggle } = useSavedResource(resourceId);
  const saved = status === "saved";
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={saved}
      disabled={pending}
      onClick={() => void toggle()}
      className={cn("min-h-11 w-full md:min-h-9", saved && "text-link")}
    >
      <Bookmark aria-hidden className={cn(saved && "fill-current")} />
      {saved ? "Saved" : "Save for later"}
    </Button>
  );
}
