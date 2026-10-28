import { addDays } from "@/services/progress/beirut-date";
import type { ProgressOverview } from "@/services/progress/types";

const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// "This week": seven dots, Monday to Sunday (Beirut time). Active days are filled with the primary,
// today is outlined. Only primary is used (green means finished), and nothing counts down or resets.
export function ThisWeek({ week }: { week: ProgressOverview["week"] }) {
  const active = new Set(week.activeDays);
  const count = week.activeDays.length;
  return (
    <section aria-labelledby="this-week-label" className="rounded-xl border bg-card p-4 md:p-5">
      <h2 id="this-week-label" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        This week
      </h2>
      <ul aria-label="This week" className="mt-4 grid grid-cols-7 gap-1">
        {NAMES.map((name, index) => {
          const date = addDays(week.start, index);
          const isActive = active.has(date);
          const isToday = date === week.today;
          const dot = isActive
            ? isToday
              ? "border-primary bg-primary ring-2 ring-primary ring-offset-2 ring-offset-card"
              : "border-primary bg-primary"
            : isToday
              ? "border-2 border-primary"
              : "border-[1.5px] border-border";
          const label = [name, ...(isActive ? ["active"] : []), ...(isToday ? ["today"] : [])];
          return (
            <li key={date} className="flex flex-col items-center gap-1.5" data-state={isActive ? "active" : "idle"} data-today={isToday ? "true" : undefined}>
              <span className="sr-only">{label.join(", ")}</span>
              <span aria-hidden className={`block size-[30px] rounded-full border md:size-7 ${dot}`} />
              <span aria-hidden className="text-xs font-medium text-muted-foreground">
                {name[0]}
              </span>
            </li>
          );
        })}
      </ul>
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
