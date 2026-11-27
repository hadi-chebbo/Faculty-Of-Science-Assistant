import { WeekDots } from "@/components/site/week-dots";
import type { ProgressOverview } from "@/services/progress/types";

// "This week": seven dots, Monday to Sunday (Beirut time), see `WeekDots`.
export function ThisWeek({ week }: { week: ProgressOverview["week"] }) {
  const count = week.activeDays.length;
  return (
    <section aria-labelledby="this-week-label" className="rounded-3xl border bg-card p-5">
      <h2 id="this-week-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        This week
      </h2>
      <WeekDots week={week} className="mt-4" />
      <p className="mt-4 text-sm text-muted-foreground">
        {count === 0 ? (
          "No active days yet this week"
        ) : (
          <>
            <strong className="font-semibold text-heading">
              {count} active {count === 1 ? "day" : "days"}
            </strong>{" "}
            this week
          </>
        )}
      </p>
    </section>
  );
}
