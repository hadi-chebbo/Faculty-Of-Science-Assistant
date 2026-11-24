import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { readForPage } from "@/lib/page-errors";
import { yearHref } from "@/lib/years";
import { getHomeStats, type HomeStats } from "@/services/courses/home";
import { SectionTitle } from "./section-title";
import { showStats, yearCardText } from "./year-card";

// The only part of the home page that reads the database. One call feeds both the numbers strip
// and the year cards; viewer is null because browsing needs no account.
export async function StatsAndYears() {
  const stats = await readForPage(() => getHomeStats(null));
  const { totals } = stats;
  const numbers = [
    { label: "Courses", value: totals.courses },
    { label: "Chapters", value: totals.chapters },
    { label: "Files to study from", value: totals.resources },
    { label: "Previous exams", value: totals.exams },
  ];

  return (
    <>
      {showStats(totals.courses) && (
        <dl className="home-strip -mt-4 grid grid-cols-2 rounded-lg border bg-card sm:grid-cols-4 md:-mt-8">
          {numbers.map(({ label, value }, i) => (
            <div
              key={label}
              className={`px-5 py-4 ${i % 2 === 1 ? "border-l" : ""} ${i >= 2 ? "border-t sm:border-t-0" : ""} sm:border-l sm:first:border-l-0`}
            >
              <dt className="text-[0.8125rem] text-muted-foreground">{label}</dt>
              <dd className="text-[1.625rem] font-semibold leading-tight tabular-nums text-heading">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <section id="years" className="home-years scroll-mt-20">
        <SectionTitle>Choose your year</SectionTitle>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.years.map((entry) => (
            <li key={entry.year}>
              <YearCard entry={entry} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function YearCard({ entry }: { entry: HomeStats["years"][number] }) {
  const text = yearCardText(entry);
  if (text.counts === null) {
    return (
      <div className="flex h-full min-h-44 flex-col rounded-2xl border border-dashed bg-muted/40 p-5 text-muted-foreground">
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-sm font-bold">
            {text.circle}
          </span>
          <span className="text-xl font-bold">{text.label}</span>
        </span>
        <span className="mt-auto pt-5 text-sm">{text.empty}</span>
      </div>
    );
  }
  return (
    <Link
      href={yearHref(entry.year)}
      className="group block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex h-full min-h-44 flex-col rounded-2xl border bg-card p-5 transition-[transform,border-color,box-shadow] motion-safe:group-hover:-translate-y-0.5 group-hover:border-primary/60 group-hover:shadow-md">
        <span className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {text.circle}
          </span>
          <span className="text-xl font-bold text-heading">{text.label}</span>
        </span>
        <span className="mt-3 flex flex-wrap gap-1.5">
          {text.codes.map((code) => (
            <span key={code} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-link">
              {code}
            </span>
          ))}
          {text.more && <span className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">{text.more}</span>}
        </span>
        <span className="mt-auto flex items-center justify-between pt-5 text-sm">
          <span className="text-muted-foreground">{text.counts}</span>
          <span className="flex items-center gap-1 font-medium text-link">
            Browse <ArrowRight aria-hidden className="size-4 transition-transform motion-safe:group-hover:translate-x-1" />
          </span>
        </span>
      </div>
    </Link>
  );
}
