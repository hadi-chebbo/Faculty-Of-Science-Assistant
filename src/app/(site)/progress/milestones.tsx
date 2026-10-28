import { Check, ClipboardCheck, Star } from "lucide-react";
import type { ReactNode } from "react";
import type { MilestoneKey } from "@/db/constants";
import type { ProgressOverview } from "@/services/progress/types";

const SYMBOLS: Record<MilestoneKey, ReactNode> = {
  first_file: "1",
  files_10: "10",
  files_50: "50",
  first_chapter: <Check className="size-6" strokeWidth={2.5} />,
  first_course: <Star className="size-6" />,
  all_exams_of_course: <ClipboardCheck className="size-6" />,
};

// "Milestones · n of 6": six fixed achievements. Earned ones are in the primary; the others are
// muted with a dashed border (no wording about what is missing). Only primary is used (green means
// finished). On a phone the row scrolls sideways and bleeds to the panel's right edge.
export function Milestones({ milestones }: { milestones: ProgressOverview["milestones"] }) {
  const count = milestones.filter((m) => m.earnedAt).length;
  return (
    <section aria-labelledby="milestones-label" className="rounded-xl border bg-card p-4 max-md:pr-0 md:p-5">
      <h2 id="milestones-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Milestones · {count} of {milestones.length}
      </h2>
      <ul aria-label="Milestones" className="relative mt-4 flex gap-1 overflow-x-auto pb-1 max-md:pr-4 md:justify-between md:overflow-visible">
        {milestones.map((m) => {
          const earned = m.earnedAt !== null;
          return (
            <li
              key={m.key}
              data-state={earned ? "earned" : "idle"}
              className="flex w-[88px] shrink-0 flex-col items-center gap-2 md:w-auto md:max-w-[120px] md:flex-1"
            >
              <span className="sr-only">{`${m.label}, ${earned ? "earned" : "not yet earned"}`}</span>
              <span
                aria-hidden
                className={`flex size-[52px] items-center justify-center rounded-full border-2 text-base font-semibold ${
                  earned ? "border-primary bg-primary/10 text-primary" : "border-dashed border-border bg-muted text-muted-foreground"
                }`}
              >
                {SYMBOLS[m.key]}
              </span>
              <span aria-hidden className={`text-center text-xs font-medium leading-snug ${earned ? "text-heading" : "text-muted-foreground"}`}>
                {m.label}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
