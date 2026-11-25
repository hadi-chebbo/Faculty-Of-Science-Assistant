import { addDays } from "@/services/progress/beirut-date";
import type { ProgressOverview } from "@/services/progress/types";

const NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Seven dots, Monday to Sunday (Beirut time): a list labelled "This week" whose items read "Monday, active" /
// "Friday, today". Active days are filled with the primary, today is outlined. Only primary is used (green means
// finished), and nothing counts down or resets. Shared by /progress and Home's card.
export function WeekDots({ week, className = "" }: { week: ProgressOverview["week"]; className?: string }) {
  const active = new Set(week.activeDays);
  return (
    <ul aria-label="This week" className={`grid grid-cols-7 gap-1 ${className}`}>
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
  );
}
