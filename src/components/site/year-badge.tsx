import { YEAR_STYLES } from "@/lib/design-language";
import { yearBadge, yearLabel, type Year } from "@/lib/years";

// A year's filled circle ("1", "2", "3", "M1"): decorative, so it is hidden from assistive technology.
// The year's name is always written next to it. Colours come from the shared design language.
export function YearCircle({ year, className = "size-10 text-sm" }: { year: Year; className?: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full font-bold ${YEAR_STYLES[year].solid} ${className}`}>
      {yearBadge(year)}
    </span>
  );
}

// A small tinted chip with the year's name ("Second year").
export function YearChip({ year, className = "" }: { year: Year; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-md px-1.5 py-0.5 text-xs font-medium ${YEAR_STYLES[year].chip} ${className}`}>
      {yearLabel(year)}
    </span>
  );
}
