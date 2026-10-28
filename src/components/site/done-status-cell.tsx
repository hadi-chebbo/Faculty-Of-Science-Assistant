"use client";

import { Check } from "lucide-react";
import type { ResourceType } from "@/db/constants";
import { useDoneCell } from "@/lib/completions-client";
import { isMarkable } from "@/services/progress/markable";

// The read-only status cell at the left of a resource row, for a signed-in student only: a green
// check (Done) or an empty circle (Not done) for a file that can be marked, and an empty cell of
// the same width for solutions and other files and while the answer is on its way, so nothing
// moves. A visitor gets no cell at all. Not a button: marking happens in the reader.
export function DoneStatusCell({ resourceId, type }: { resourceId: string; type: ResourceType }) {
  const state = useDoneCell(resourceId);
  if (state === "none") return null;
  const shown = state !== "reserved" && isMarkable(type) ? state : null;
  return (
    <div className="flex shrink-0 items-center pl-3">
      {shown === "done" && (
        <span
          role="img"
          aria-label="Done"
          className="flex size-[22px] items-center justify-center rounded-full bg-success text-success-foreground"
        >
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {shown === "not-done" && (
        <span role="img" aria-label="Not done" className="size-[22px] rounded-full border-[1.5px] border-border" />
      )}
      {shown === null && <span aria-hidden className="size-[22px]" />}
    </div>
  );
}
