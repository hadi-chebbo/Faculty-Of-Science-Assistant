import { ArrowRight, CalendarRange, Files, LibraryBig, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { YearCircle } from "@/components/site/year-badge";
import { TYPE_STYLES, YEAR_STYLES } from "@/lib/design-language";
import { readForPage } from "@/lib/page-errors";
import { yearHref } from "@/lib/years";
import { getHomeStats, type HomeStats } from "@/services/courses/home";
import { SectionTitle } from "./section-title";
import { statTiles, type StatKey } from "./stats-row";
import { yearCardText } from "./year-card";

// The only part of the home page that reads the database: one call for the year cards and the numbers row
// under them. The viewer is null because browsing needs no account, so drafts are never counted.
export async function YearCards() {
  const stats = await readForPage(() => getHomeStats(null));
  return (
    <>
      <section id="years" className="home-years scroll-mt-20">
        <SectionTitle>Choose your year</SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.years.map((entry, index) => (
            <li key={entry.year}>
              <YearCard entry={entry} delay={index * 70} />
            </li>
          ))}
        </ul>
      </section>
      <StatsRow totals={stats.totals} />
    </>
  );
}

// The exam tile takes the exam type's colour (as on every exam row); the others the brand tint.
const STAT_ICONS: Record<StatKey, { icon: LucideIcon; tint: string }> = {
  files: { icon: Files, tint: "bg-primary/10 text-link" },
  courses: { icon: LibraryBig, tint: "bg-primary/10 text-link" },
  exams: { icon: TYPE_STYLES.exam.icon, tint: TYPE_STYLES.exam.chip },
  examYears: { icon: CalendarRange, tint: "bg-primary/10 text-link" },
};

// Live catalogue numbers: a 2x2 grid on a phone, one row of four from md up. Not links; hidden with no files.
function StatsRow({ totals }: { totals: HomeStats["totals"] }) {
  const tiles = statTiles(totals);
  if (tiles.length === 0) return null;
  return (
    <section id="numbers" className="home-stats" aria-label="In numbers">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile, index) => {
          const { icon: Icon, tint } = STAT_ICONS[tile.key];
          return (
            <li
              key={tile.key}
              style={{ "--rise-delay": `${index * 70}ms` } as React.CSSProperties}
              className="rise-in flex flex-col gap-3 rounded-3xl border bg-card p-4 md:p-5"
            >
              <span aria-hidden className={`flex size-10 items-center justify-center rounded-xl ${tint}`}>
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col">
                <span className="text-2xl font-bold tabular-nums tracking-tight text-heading md:text-3xl">{tile.value}</span>
                <span className="text-sm text-muted-foreground">{tile.label}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function YearCard({ entry, delay }: { entry: HomeStats["years"][number]; delay: number }) {
  const text = yearCardText(entry);
  const style = YEAR_STYLES[entry.year];
  const riseDelay = { "--rise-delay": `${delay}ms` } as React.CSSProperties;
  if (text.counts === null) {
    return (
      <div
        style={riseDelay}
        className="rise-in flex h-full min-h-44 flex-col rounded-3xl border border-dashed bg-muted/40 p-5 text-muted-foreground"
      >
        <span className="flex items-center gap-3">
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
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
      className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div
        style={riseDelay}
        className={`rise-in flex h-full min-h-44 flex-col rounded-3xl border bg-card p-5 transition-[transform,border-color,box-shadow] motion-safe:group-hover:-translate-y-1 group-hover:shadow-md ${style.border}`}
      >
        <span className="flex items-center gap-3">
          <YearCircle year={entry.year} />
          <span className="text-xl font-bold text-heading">{text.label}</span>
        </span>
        <span className="mt-3 flex flex-wrap gap-1.5">
          {text.codes.map((code) => (
            <span key={code} className={`rounded-md px-1.5 py-0.5 font-mono text-xs font-medium ${style.chip}`}>
              {code}
            </span>
          ))}
          {text.more && <span className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground">{text.more}</span>}
        </span>
        <span className="mt-auto flex items-center justify-between pt-5 text-sm">
          <span className="text-muted-foreground">{text.counts}</span>
          <span className="flex items-center gap-1 font-medium text-link">
            Open <ArrowRight aria-hidden className="size-4 transition-transform motion-safe:group-hover:translate-x-1" />
          </span>
        </span>
      </div>
    </Link>
  );
}
